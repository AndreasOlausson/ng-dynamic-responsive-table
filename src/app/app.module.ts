import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { DynamicResponsiveTableDirective } from './directives/dynamic-responsive-table.directive';

@NgModule({
  declarations: [
    AppComponent,
    DynamicResponsiveTableDirective
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  exports: [DynamicResponsiveTableDirective]
})
export class AppModule { }
