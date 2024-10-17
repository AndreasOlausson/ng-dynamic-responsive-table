import {Directive, AfterViewInit, ElementRef, ViewChild, Input, Output, EventEmitter, HostListener} from '@angular/core';

@Directive({
  selector: '[appDynamicResponsiveTable]'
})
export class DynamicResponsiveTableDirective implements AfterViewInit {

  @Input() tableId = '';
  @Input() usePrioritization = false;
  @Input() maxRuns = 10;
  @Input() resizeDelay = 100;

  @Output() drtCurrentTableInfo = new EventEmitter<IResponsiveTableInfo>();
  @Output() drtSelectedInfoRow = new EventEmitter<HTMLTableCellElement[]>();
  @Output() drtInfoHeaders = new EventEmitter<HTMLTableHeaderCellElement[]>();
  @Output() drtInfoCells = new EventEmitter<HTMLTableElement[]>();
  @Output() drtInfoPopUpInternalIndex = new EventEmitter<number>();

  private tableElement: HTMLTableElement;
  private tableWrapperElement: HTMLElement;
  private tableHeaders: HTMLTableHeaderCellElement[] = [];
  private tableBody: HTMLTableElement[];
  private tableBodyRows: HTMLTableRowElement[];

  private readonly tableInfo: IResponsiveTableInfo;
  private minColumnWidths: number[] = [];
  private visibleRowIndexes: number[] = [];
  private hiddenRowIndexes: number[] = [];

  private readonly cssShow = 'drt-show';
  private readonly cssHide = 'drt-hide';
  private readonly cssInfo = 'drt-info';
  private readonly cssNoShowPopup = 'drt-no-show-popup';
  private readonly cssNeverHide = 'drt-never-hide';
  private readonly cssAlwaysHide = 'drt-always-hide';
  private readonly attrPriorityName = 'data-drt-priority';
  private readonly attrInternalRowIdName = 'data-internal-row-id';
  private hasInfoCells: boolean;
  private infoRowIndexes: number[] = [];
  private resizeHandle: number;
  initialized = false;

  constructor(private readonly elementRef: ElementRef) {
    this.tableElement = null;
    this.tableInfo = {
      visibleTableContentWidth: 0,
      hiddenTableContentWidth: 0,
      hasInfoColumns: false,
      columns: []
    };
  }
  @HostListener('window:resize')
  onResize(): void {
    if (this.resizeHandle) {
      clearTimeout(this.resizeHandle);
    }
    if (this.initialized) {
      this.resizeHandle = setTimeout(() => {
        // TODO Check why we have to do this...
        if (this.tableBodyRows.length < 1) {
          this.getTableRows();
        }
        this.setInitClasses();
        this.fitTable();
        this.dispatchTableInfoEvent();
      }, this.resizeDelay);
    }
  }

  @HostListener('document:triggerResponsiveReInitialize', ['$event.detail.sender'])
  onTableRedraw(sender: string): void {
    if (this.tableId === sender) {
      this.initialize(true);
    }
  }

  @HostListener('document:getRowChildren', ['$event', '$event.detail.idx', '$event.detail.sender'])
  onTableGetRowChildren(event: any, idx: number, sender: string): void {
    if (this.tableId === sender) {

      const internalIdx = Array.from(this.tableBodyRows)
        .findIndex(x => x.getAttribute(this.attrInternalRowIdName) === idx.toString());
      const hiddenHeaders = Array.from(this.tableHeaders)
        .filter((e) => e.classList.contains('drt-hide') && !e.classList.contains('drt-info'));
      const hiddenCells = Array.from(this.getSelectedRowChildren(internalIdx).children)
        .filter((e) => e.classList.contains('drt-hide') && !e.classList.contains('drt-info')) as HTMLTableElement[];
      this.drtInfoHeaders.emit(hiddenHeaders);
      this.drtInfoCells.emit(hiddenCells);

      this.drtSelectedInfoRow.emit(Array.from(this.getSelectedRowChildren(internalIdx).children) as HTMLTableCellElement[]);
      this.drtCurrentTableInfo.emit(this.tableInfo);

      this.drtInfoPopUpInternalIndex.emit(internalIdx);
    }
    // this.infoRowBroadcast(Array.from(this.getSelectedRowChildren(idx).children) as HTMLTableCellElement[]);
  }

  ngAfterViewInit(): void {
    this.initialize();
  }

  initialize(reDraw: boolean = false): void {
    this.getTableElements();
    this.getTableHeaders();
    this.getTableRows();

    this.addInfoColumnIfMissing();

    this.collectColumnWidths(reDraw);
    console.log('tableElement', this.tableElement);
    console.log('tableWrapperElement', this.tableWrapperElement);
    console.log('tableHeaders', this.tableHeaders);
    console.log('tableBody', this.tableBody);
    console.log('tableBodyRows', this.tableBodyRows);
    console.log('tableInfo', this.tableInfo);


    this.setInitClasses();
    this.setAttributes();
    this.fitTable();
    this.collectTableInfo();
    this.dispatchTableInfoEvent();
    this.initialized = true;

    console.log("this", this);

  }
  private getTableElements(): void {
    if (this.elementRef.nativeElement instanceof HTMLTableElement) {
      this.tableElement = this.elementRef.nativeElement;
      this.tableWrapperElement = this.elementRef.nativeElement.parentElement;
    } else {
      this.tableElement = this.elementRef.nativeElement.getElementsByTagName('Table')[0];
      this.tableWrapperElement = this.elementRef.nativeElement;
    }
  }
  private getTableHeaders(): void {
    this.tableHeaders = Array.from(this.tableElement.querySelectorAll('thead > tr')[0].children) as HTMLTableHeaderCellElement[];
  }
  private getTableRows(): void {
    this.tableBody = Array.from(this.tableElement.children).filter((e) => e.tagName === 'TBODY') as HTMLTableElement[];
    this.tableBodyRows = Array.from(this.tableBody[0].children) as HTMLTableRowElement[];
  }
  private addInfoColumnIfMissing(): void {
    const infoCells = this.tableHeaders.filter(x => x.classList.contains('drt-info'));
    if (infoCells.length === 0) {
      const th: HTMLTableHeaderCellElement = document.createElement('th');
      th.classList.add(this.cssInfo);
      th.innerText = 'x';
      console.log("This doesn't show up in the table, why?");
      this.tableHeaders.push(th);



      this.tableBodyRows.forEach((r) => {
        const td = document.createElement('td');
        td.classList.add(this.cssInfo);
        td.innerText = 'z';
        r.appendChild(td);
      });


    }
    console.log("do we have info-cell(s)", infoCells);
  }


  private collectColumnWidths(initialized: boolean): void {

    // const tableStyle = window.getComputedStyle(this.targetTable);
    // const tableWidth = parseFloat(this.targetTable.offsetWidth.toString());
    // return parseFloat(tableStyle.width.match(/[\d|\.]+/i)[0]);

    this.tableInfo.columns = [];
    for (let i = 0; i < this.tableHeaders.length; i++) {
      if (initialized) {
        this.minColumnWidths[i] = this.minColumnWidths[i];
      } else {
        // this.minColumnWidths[i] = parseFloat((window.getComputedStyle(this.headers[i]).width.match(/[\d|\.]+/i)[0]));
        this.minColumnWidths[i] = this.tableHeaders[i].clientWidth;
      }

      this.tableInfo.columns.push({
        // visibleMinWidth: parseFloat((window.getComputedStyle(this.headers[i]).width.match(/[\d|\.]+/i)[0])),
        visibleMinWidth: this.tableHeaders[i].clientWidth,
        isInfo: this.tableHeaders[i].classList.contains(this.cssInfo)
      });
    }
  }

  private setInitClasses(): void {
    this.visibleRowIndexes = [];
    this.hiddenRowIndexes = [];
    const rowIndexes: number[] = [];
    const sortedHeaderIndexes: number[] = [];
    let normalizedSortedHeaderIndexes: number[] = [];
    let highestPriority = 0;

    highestPriority = this.getHighestPriorityValue();

    for (let i = 0; i < this.tableHeaders.length; i++) {
      const headerCell = this.tableHeaders[i];

      if (headerCell.classList.contains(this.cssAlwaysHide) === false) {
        const priorityValue = headerCell.getAttribute(this.attrPriorityName);
        if (headerCell.classList.contains(this.cssInfo)) {
          this.hasInfoCells = true;
          this.infoRowIndexes.push(i);
        } else {
          rowIndexes.push(i);
        }
        if (priorityValue) {
          sortedHeaderIndexes.push(parseInt(priorityValue));
        } else {
          headerCell.setAttribute(this.attrPriorityName, (highestPriority + i).toString());
          sortedHeaderIndexes.push((highestPriority + i).valueOf());
        }
        headerCell.classList.remove(this.cssHide);
        headerCell.classList.add(this.cssShow);
      }
    }

    if (this.usePrioritization) {
      normalizedSortedHeaderIndexes = this.normalizeSortArray(sortedHeaderIndexes);
      this.visibleRowIndexes = this.refSort(rowIndexes, normalizedSortedHeaderIndexes);
    } else {
      this.visibleRowIndexes = rowIndexes;
    }

    this.tableBodyRows.forEach(item1 => {
      const rowCells = item1.children;
      for (let j = 0; j < rowCells.length; j++) {
        const cell = rowCells[j];
        cell.classList.remove(this.cssInfo);
        cell.classList.remove(this.cssHide);
        cell.classList.add(this.cssShow);
        if (this.tableHeaders[j].classList.contains(this.cssNoShowPopup)) {
          cell.classList.add(this.cssNoShowPopup);
        }
        if (this.tableHeaders[j].classList.contains(this.cssNeverHide)) {
          cell.classList.add(this.cssNeverHide);
        }
        if (this.tableHeaders[j].classList.contains(this.cssAlwaysHide)) {
          cell.classList.add(this.cssAlwaysHide);
        }
      }
      this.infoRowIndexes.forEach(item => {
        rowCells[item].classList.add(this.cssInfo);
      });
    });

  }
  private setAttributes(): void {
    this.tableBodyRows.forEach(item => {
      const rowCells = item.children;
      for (let j = 0; j < rowCells.length; j++) {
        const cell = rowCells[j];
        cell.setAttribute('data-header', this.tableHeaders[j].innerText.trim());
        cell.setAttribute('data-column-min-width', this.minColumnWidths[j].toString());
      }
    });
  }
  private fitTable(): void {
    let counter = 0;
    let parsedTableWidth = this.getParsedTableWidth();
    let parsedParentWidth = this.getParsedWrapperWidth();

    while (parsedTableWidth > parsedParentWidth && counter < this.maxRuns) {
      counter++;
      let lastIndex = -1;
      if (this.usePrioritization) {
        lastIndex = this.visibleRowIndexes.indexOf(this.visibleRowIndexes[this.visibleRowIndexes.length - 1]);
      } else {
        lastIndex = Math.max.apply(null, this.visibleRowIndexes);
      }

      if (lastIndex === -Infinity || lastIndex === Infinity || lastIndex === -1) {
        break;
      }

      const lastHeader = this.tableHeaders[lastIndex];
      lastHeader.classList.remove(this.cssShow);
      lastHeader.classList.add(this.cssHide);

      this.tableBodyRows.forEach(item => {
        const rowCells = item.children;
        // const rowCells = Array.from(this.tableBodyRows[i].children)
        //    .filter(x => x.classList.contains("drt-never-hide") === false);
        const cell = rowCells[lastIndex];
        cell.classList.remove(this.cssShow);
        cell.classList.add(this.cssHide);
      });

      this.toggleInfoCellsVisibility(true);

      this.moveElement(this.visibleRowIndexes, this.hiddenRowIndexes, this.visibleRowIndexes[lastIndex]);

      parsedTableWidth = this.getParsedTableWidth();
      parsedParentWidth = this.getParsedWrapperWidth();
    }
  }
  private moveElement(source, target, elem): void {
    for (let i = 0; i < source.length; i++) {
      const element = source[i];
      if (elem === element) {
        source.splice(i, 1);
        target.push(element);
        i--;
      }
    }
  }
  private toggleInfoCellsVisibility(infoIsVisible: boolean): void {
    this.infoRowIndexes.forEach(idx => {
      this.tableHeaders[idx].classList.remove(infoIsVisible ? this.cssShow : this.cssHide);
      this.tableHeaders[idx].classList.add(infoIsVisible ? this.cssHide : this.cssShow);

      this.tableBodyRows.forEach(item => {
        const row = item.children;
        const cell = row[idx];
        cell.classList.remove(infoIsVisible ? this.cssShow : this.cssHide);
        cell.classList.add(infoIsVisible ? this.cssHide : this.cssShow);
      });
    });
  }
  private getParsedTableWidth(): number {
    const tableStyle = window.getComputedStyle(this.tableElement);
    const tableWidth = parseFloat(this.tableElement.offsetWidth.toString());
    // return parseFloat(tableStyle.width.match(/[\d|\.]+/i)[0]);
    return tableWidth;
  }
  private getParsedWrapperWidth(): number {
    const wrapperStyle = window.getComputedStyle(this.tableWrapperElement);
    const wrapperWidth = parseFloat(this.tableWrapperElement.offsetWidth.toString());
    // return parseFloat(wrapperStyle.width.match(/[\d|\.]+/i)[0]);
    return wrapperWidth;
  }
  private getHighestPriorityValue(): number {
    const cells = this.tableHeaders.filter(x => x.hasAttribute('data-drt-priority'));
    let highest = 0;

    cells.forEach(item => {
      const prioValue = parseInt(item.getAttribute('data-drt-priority'));
      if (highest < prioValue) {
        highest = prioValue;
      }
    });
    return highest;
  }
  private normalizeSortArray(sortArr: number[]): number[] {
    let lowest = 0;
    sortArr.forEach(item => {
      if (item < lowest) {
        lowest = item;
      }
    });
    return sortArr.map(item => item - lowest);
  }
  private refSort(targetData, refData): number[] {

    refData = this.normalizeSortArray(refData);
    // Create an array of indices [0, 1, 2, ...N].
    const indices = Object.keys(refData);
    // Sort array of indices according to the reference data.
    indices.sort((indexA, indexB) => {
      if (refData[indexA] < refData[indexB]) {
        return -1;
      } else if (refData[indexA] > refData[indexB]) {
        return 1;
      }
      return 0;
    });
    // Map array of indices to corresponding values of the target array.
    return indices.map(index => targetData[index]);
  }
  private dispatchTableInfoEvent(): void {
    // const customEvent = new CustomEvent("tableInfoChange", {
    //     detail: {
    //         tableInfo: this.getCurrentTableInfo()
    //     }
    // });
    setTimeout(() => {
      this.drtCurrentTableInfo.emit(this.tableInfo);
      // document.dispatchEvent(customEvent);
    }, 20);
  }
  private getSelectedRowChildren(idx: number): HTMLTableRowElement {
    const row = this.tableBodyRows[idx];
    return row;
  }
  private collectTableInfo(): void {
    let visibleWidth = 0;
    let hiddenWidth = 0;
    let hasInfo = false;

    for (let i = 0; i < this.tableHeaders.length; i++) {
      if (this.tableHeaders[i].classList.contains(this.cssShow)) {
        if (this.tableHeaders[i].classList.contains(this.cssInfo)) {
          hasInfo = true;
          this.tableInfo.columns[i].isVisible = false;
          hiddenWidth += this.minColumnWidths[i];
        } else {
          this.tableInfo.columns[i].isVisible = true;
          visibleWidth += this.tableHeaders[i].clientWidth;
        }
      }
      if (this.tableHeaders[i].classList.contains(this.cssHide)) {
        if (this.tableHeaders[i].classList.contains(this.cssInfo)) {
          hasInfo = true;
          this.tableInfo.columns[i].isVisible = true;
          visibleWidth += this.tableHeaders[i].clientWidth;
        } else {
          this.tableInfo.columns[i].isVisible = false;
          hiddenWidth += this.minColumnWidths[i];
        }
      }
    }
    this.tableInfo.hasInfoColumns = hasInfo;
    this.tableInfo.visibleTableContentWidth = visibleWidth;
    this.tableInfo.hiddenTableContentWidth = hiddenWidth;
  }
}
export interface IResponsiveTableInfo {
  columns?: IResponsiveTableColumnProperties[];
  visibleTableContentWidth?: number;
  hiddenTableContentWidth?: number;
  hasInfoColumns?: boolean;
}
export interface IResponsiveTableColumns {
  visibleMinWidth?: number;
  isVisible?: boolean;
  isInfo?: boolean;
}
export interface IResponsiveTableColumnProperties {
  visibleMinWidth?: number;
  isVisible?: boolean;
  isInfo?: boolean;
  alwaysShow?: boolean;
  alwaysHide?: boolean;
  originalPriorityValue?: number;
  normalizedPriorityValue?: number;
  originalSortIndex?: number;
  sortOrder?: number;
  isPopupVisible?: boolean;
}
