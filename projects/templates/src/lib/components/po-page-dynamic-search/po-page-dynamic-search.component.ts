import { Component, ViewChild, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { Observable, Subscription } from 'rxjs';
import {
  PoDisclaimerGroup,
  PoDynamicFieldType,
  PoDynamicFormField,
  PoLanguageService,
  PoPageFilter
} from '@po-ui/ng-components';

import { capitalizeFirstLetter, getBrowserLanguage } from '../../utils/util';
import { PoPageCustomizationService } from '../../services/po-page-customization/po-page-customization.service';

import { PoAdvancedFilterComponent } from './po-advanced-filter/po-advanced-filter.component';
import { PoPageDynamicSearchBaseComponent } from './po-page-dynamic-search-base.component';
import { PoPageDynamicSearchOptions } from './po-page-dynamic-search-options.interface';
import { PoPageDynamicOptionsSchema } from '../../services';
import { PoPageDynamicSearchFilters } from './po-page-dynamic-search-filters.interface';

type UrlOrPoCustomizationFunction = string | (() => PoPageDynamicSearchOptions);

/**
 * @docsExtends PoPageDynamicSearchBaseComponent
 *
 * @example
 *
 * <example name="po-page-dynamic-search-basic" title="PO Page Dynamic Search Basic">
 *  <file name="sample-po-page-dynamic-search-basic/sample-po-page-dynamic-search-basic.component.html"> </file>
 *  <file name="sample-po-page-dynamic-search-basic/sample-po-page-dynamic-search-basic.component.ts"> </file>
 * </example>
 *
 * <example name="po-page-dynamic-search-hiring-processes" title="PO Page Dynamic Search - Hiring processes">
 *  <file name="sample-po-page-dynamic-search-hiring-processes/sample-po-page-dynamic-search-hiring-processes.component.html"> </file>
 *  <file name="sample-po-page-dynamic-search-hiring-processes/sample-po-page-dynamic-search-hiring-processes.component.ts"> </file>
 *  <file name="sample-po-page-dynamic-search-hiring-processes/sample-po-page-dynamic-search-hiring-processes.service.ts"> </file>
 * </example>
 */
@Component({
  selector: 'po-page-dynamic-search',
  templateUrl: './po-page-dynamic-search.component.html'
})
export class PoPageDynamicSearchComponent extends PoPageDynamicSearchBaseComponent implements OnInit, OnDestroy {
  private loadSubscription: Subscription;
  private previousDisclaimers = [];
  private appliedFromSearch = false;

  private readonly _disclaimerGroup: PoDisclaimerGroup = {
    change: this.onChangeDisclaimerGroup.bind(this),
    disclaimers: [],
    title: this.literals.disclaimerGroupTitle
  };

  private readonly _filterSettings: PoPageFilter = {
    action: 'onAction',
    advancedAction: 'onAdvancedAction',
    ngModel: 'quickFilter',
    placeholder: this.literals.searchPlaceholder
  };
  private quickFilter;

  @ViewChild(PoAdvancedFilterComponent, { static: true }) poAdvancedFilter: PoAdvancedFilterComponent;

  constructor(
    languageService: PoLanguageService,
    private poPageCustomizationService: PoPageCustomizationService,
    private changeDetector: ChangeDetectorRef
  ) {
    super(languageService);
  }

  get disclaimerGroup() {
    return Object.assign({}, this._disclaimerGroup, { title: this.literals.disclaimerGroupTitle });
  }

  get filterSettings() {
    this._filterSettings.advancedAction = this.filters.length === 0 ? undefined : 'onAdvancedAction';

    return Object.assign({}, this._filterSettings, { placeholder: this.literals.searchPlaceholder });
  }

  ngOnInit() {
    this.setAdvancedFilterLiterals(this.literals);
    if (this.onLoad) {
      this.loadOptionsOnInitialize(this.onLoad);
    }
  }

  ngOnDestroy() {
    if (this.loadSubscription) {
      this.loadSubscription.unsubscribe();
    }
  }

  onChangeFilters(filters: Array<PoPageDynamicSearchFilters>) {
    const filterObjectWithValue = filters
      .filter(filter => filter.initValue)
      .reduce((prev, current) => {
        return { ...prev, ...{ [current.property]: current.initValue } };
      }, {});

    if (Object.keys(filterObjectWithValue).length) {
      this.onAdvancedSearch(filterObjectWithValue);
    }
  }

  onAction() {
    const disclaimerQuickSearchUpdated = {
      property: 'search',
      label: `${this.literals.quickSearchLabel} ${this.quickFilter}`,
      value: this.quickFilter
    };

    const currentQuickSearchDisclaimer = this._disclaimerGroup.disclaimers.find(
      disclaimer => disclaimer.property === 'search'
    );
    this.appliedFromSearch = disclaimerQuickSearchUpdated.value !== currentQuickSearchDisclaimer?.value;

    const getDisclaimersWithConcatFilters = () => [
      ...this.getDisclaimersWithoutQuickSearch(),
      disclaimerQuickSearchUpdated
    ];

    this._disclaimerGroup.disclaimers = this.concatFilters
      ? getDisclaimersWithConcatFilters()
      : [disclaimerQuickSearchUpdated];

    if (this.quickSearch.observers && this.quickSearch.observers.length > 0) {
      this.quickSearch.emit(this.quickFilter);
    }

    if (this.keepFilters && !this.concatFilters) {
      this.filters.forEach(element => delete element.initValue);
    }

    this.quickFilter = undefined;

    this.changeDetector.detectChanges();
  }

  onAdvancedAction() {
    this.poAdvancedFilter.open();
  }

  onAdvancedSearch(filters) {
    const currentFilters = this.formatArrayToObjectKeyValue(this.filters);
    this.appliedFromSearch = JSON.stringify(filters) !== JSON.stringify(currentFilters);

    this._disclaimerGroup.disclaimers = this.setDisclaimers(filters);

    this.setFilters(filters);

    this.advancedSearch.emit(filters);
  }

  private getDisclaimersWithoutQuickSearch() {
    const quickSearchProperty = 'search';
    return this._disclaimerGroup.disclaimers.filter(item => item.property !== quickSearchProperty);
  }

  private setFilters(filters) {
    const formattedFilters = this.convertToFilters(filters);

    this.filters.forEach(element => {
      const compatibleObject = formattedFilters.find(item => item.property === element.property);

      if (compatibleObject) {
        element.initValue = compatibleObject.value;
      } else {
        delete element.initValue;
      }
    });
  }

  private convertToFilters(filters) {
    return Object.entries(filters).map(([property, value]) => ({ property, value }));
  }

  private applyDisclaimerLabelValue(field: any, filterValue: any) {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];

    const labels = values.map(value => {
      const filteredField = field.options.find(option => option.value === value || option === value);

      if (filteredField) {
        return filteredField.label || filteredField.value || filteredField;
      }
    });

    return labels.join(', ');
  }

  private formatDate(date: string) {
    const year = parseInt(date.substr(0, 4), 10);
    const month = parseInt(date.substr(5, 2), 10);
    const day = parseInt(date.substr(8, 2), 10);

    return new Date(year, month - 1, day).toLocaleDateString(getBrowserLanguage());
  }

  private formatArrayToObjectKeyValue(
    filters: Array<{ property: string; value?: any; initValue?: any }>
  ): { [key: string]: any } {
    const formattedObject = filters.reduce(
      (result, item) => Object.assign(result, { [item.property]: item.value || item.initValue }),
      {}
    );

    Object.keys(formattedObject).forEach(key => {
      if (!formattedObject[key]) {
        delete formattedObject[key];
      }
    });

    return formattedObject;
  }

  private getFieldByProperty(fields: Array<PoDynamicFormField>, fieldName: string) {
    return fields.find((field: PoDynamicFormField) => field.property === fieldName);
  }

  private getFilterValueToDisclaimer(field: any, value: any) {
    if (field.type === PoDynamicFieldType.Date) {
      return this.formatDate(value);
    }

    if (field.options && value) {
      return this.applyDisclaimerLabelValue(field, value);
    }

    return value;
  }

  private onChangeDisclaimerGroup(disclaimers) {
    const isDiclaimersLessThanPrevious = this.previousDisclaimers.length > disclaimers.length;
    const isRemovedDisclaimers = (!this.appliedFromSearch && isDiclaimersLessThanPrevious) || disclaimers.length === 0;

    if (isRemovedDisclaimers) {
      this.changeDisclaimers.emit(disclaimers);
      this.setFilters(this.formatArrayToObjectKeyValue(disclaimers));
    }

    this.appliedFromSearch = false;
    this.previousDisclaimers = [...disclaimers];
  }

  private setDisclaimers(filters) {
    const disclaimers = [];
    const properties = Object.keys(filters);

    properties.forEach(property => {
      const field = this.getFieldByProperty(this.filters, property);
      const label = field.label || capitalizeFirstLetter(field.property);
      const value = filters[property];

      const valueDisplayedOnTheDisclaimerLabel = this.getFilterValueToDisclaimer(field, value);

      if (valueDisplayedOnTheDisclaimerLabel !== '') {
        disclaimers.push({
          label: `${label}: ${valueDisplayedOnTheDisclaimerLabel}`,
          property,
          value
        });
      }
    });

    return disclaimers;
  }

  private loadOptionsOnInitialize(onLoad: UrlOrPoCustomizationFunction) {
    this.loadSubscription = this.getPoDynamicPageOptions(onLoad).subscribe(responsePoOption =>
      this.poPageCustomizationService.changeOriginalOptionsToNewOptions(this, responsePoOption)
    );
  }

  private getPoDynamicPageOptions(onLoad: UrlOrPoCustomizationFunction): Observable<PoPageDynamicSearchOptions> {
    const originalOption: PoPageDynamicSearchOptions = {
      title: this.title,
      actions: this.actions,
      breadcrumb: this.breadcrumb,
      filters: this.filters,
      keepFilters: this.keepFilters,
      concatFilters: this.concatFilters
    };

    const pageOptionSchema: PoPageDynamicOptionsSchema<PoPageDynamicSearchOptions> = {
      schema: [
        {
          nameProp: 'filters',
          merge: true,
          keyForMerge: 'property'
        },
        {
          nameProp: 'actions',
          merge: true,
          keyForMerge: 'label'
        },
        {
          nameProp: 'breadcrumb'
        },
        {
          nameProp: 'title'
        },
        {
          nameProp: 'keepFilters'
        },
        {
          nameProp: 'concatFilters'
        }
      ]
    };

    return this.poPageCustomizationService.getCustomOptions(onLoad, originalOption, pageOptionSchema);
  }
}
