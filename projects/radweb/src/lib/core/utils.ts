


import { makeTitle, isFunction, functionOrString } from './common';

import {
  DataColumnSettings, ColumnOptions, FilterBase, ColumnValueProvider, FindOptions, FindOptionsPerEntity, RowEvents, EntityDataProvider, DataProvider, FilterConsumer
  , ColumnStorage,

  EntityProvider,
  ColumnDisplay,
  EntityOrderBy,
  EntityWhere
} from './dataInterfaces1';
import { Allowed, Context, DirectSQL } from '../context/Context';
import { DataApiSettings } from '../server/DataApi';
import { isBoolean, isString, isArray } from 'util';
import { Column } from './column';








export interface dataAreaSettings {
  columns: ColumnCollection<any>;
  lines: ColumnSetting<any>[][];
}



export const testing = 'testing 123';











export interface DropDownOptions {

  items?: DropDownItem[] | string[] | any[];
  source?: DropDownSource<any>;
}
export class DropDownSource<rowType extends Entity<any>>{
  async provideItems(): Promise<DropDownItem[]> {

    return (await this.provider.find({
      where: this.args.where,
      orderBy: this.args.orderBy
    })).map(x => {
      return {
        id: this.args.idColumn(x).value,
        caption: this.args.captionColumn(x).value
      }
    });
  }
  constructor(private provider: EntityProvider<rowType>, private args?: DropDownSourceArgs<rowType>) {
    if (!args) {
      this.args = args = {};
    }
    if (!args.idColumn) {
      args.idColumn = x => x.__idColumn;
    }
    if (!args.captionColumn) {
      let item = provider.create();
      let idCol = args.idColumn(item);
      for (const keyInItem of item.__iterateColumns()) {
        if (keyInItem != idCol) {
          args.captionColumn = x => x.__getColumn(keyInItem);
          break;
        }
      }
    }
  }
}
export interface DropDownSourceArgs<rowType extends Entity<any>> {
  idColumn?: (e: rowType) => Column<any>,
  captionColumn?: (e: rowType) => Column<any>,
  orderBy?: EntityOrderBy<rowType>,
  where?: EntityWhere<rowType>
}

export interface DropDownItem {
  id?: any;
  caption?: any;
}

export type DataArealColumnSetting<rowType> = ColumnSetting<rowType> | ColumnSetting<rowType>[];






export interface IDataAreaSettings<rowType> {
  columnSettings?: (rowType: rowType) => DataArealColumnSetting<rowType>[];
  numberOfColumnAreas?: number;
  labelWidth?: number;
}

export class DataAreaSettings<rowType extends Entity<any>>
{
  lines: ColumnSetting<any>[][] = [];
  constructor(public settings?: IDataAreaSettings<rowType>, public columns?: ColumnCollection<rowType>, entity?: rowType) {
    if (columns == undefined) {
      columns = new ColumnCollection<rowType>(() => undefined, () => true, undefined, () => true);
      columns.numOfColumnsInGrid = 0;
      this.columns = columns;
    }
    if (settings && settings.columnSettings) {


      for (const colSettings of settings.columnSettings(entity)) {
        if (isArray(colSettings)) {
          let x = columns.items.length;
          //@ts-ignore
          columns.add(...colSettings);
          let line = [];
          for (let index = x; index < columns.items.length; index++) {
            line.push(columns.items[index]);
          }
          this.lines.push(line);
        } else {
          columns.add(<ColumnSetting<rowType>>colSettings);
          this.lines.push([columns.items[columns.items.length - 1]]);

        }
      }


    }

  }
}






export class GridSettings<rowType extends Entity<any>>  {
  constructor(private entityProvider: EntityProvider<rowType>, context: Context, public settings?: IDataSettings<rowType>) {
    this.restList = new DataList<rowType>(entityProvider);
    if (entityProvider) {
      this.filterHelper.filterRow = <rowType>entityProvider.create();
    }

    this.columns = new ColumnCollection<rowType>(() => this.currentRow, () => this.allowUpdate, this.filterHelper, () => this.currentRow ? true : false, context)

    this.restList._rowReplacedListeners.push((old, curr) => {
      if (old == this.currentRow)
        this.setCurrentRow(curr);
    });

    if (settings) {

      if (settings.columnSettings)
        this.columns.add(...settings.columnSettings(entityProvider.create()));

      if (settings.allowUpdate)
        this.allowUpdate = true;
      if (settings.allowDelete)
        this.allowDelete = true;
      if (settings.allowInsert)
        this.allowInsert = true;
      if (settings.hideDataArea)
        this.hideDataArea = settings.hideDataArea;
      if (settings.numOfColumnsInGrid != undefined)
        this.columns.numOfColumnsInGrid = settings.numOfColumnsInGrid;

      if (settings.rowButtons)
        this._buttons = settings.rowButtons;


      if (settings.rowCssClass)
        this.rowClass = settings.rowCssClass;
      if (settings.onSavingRow)
        this.onSavingRow = settings.onSavingRow;
      if (settings.onEnterRow)
        this.onEnterRow = settings.onEnterRow;
      if (settings.onNewRow)
        this.onNewRow = settings.onNewRow;
      if (settings.onValidate)
        this.onValidate = settings.onValidate;
      if (settings.caption)
        this.caption = settings.caption;
      if (!this.caption && entityProvider) {
        this.caption = entityProvider.create().__getCaption();
      }
      this.setGetOptions(settings.get);

    }


  }

  currList: ColumnSetting<any>[];
  origList: ColumnSetting<any>[];
  origNumOfColumns: number;
  showSelectColumn = false;

  initOrigList() {
    if (!this.origList) {
      this.origList = [];
      this.origNumOfColumns = this.columns.numOfColumnsInGrid;
      this.origList.push(...this.columns.items);
    }
  }
  userChooseColumns() {
    this.initOrigList();
    if (!this.currList) {

      this.resetColumns();

    }
    this.showSelectColumn = !this.showSelectColumn;
  }
  resetColumns() {
    this.currList = [];
    this.columns.items = this.currList;
    this.columns.numOfColumnsInGrid = this.origNumOfColumns;
    for (let i = 0; i < this.origList.length; i++) {
      if (i < this.columns.numOfColumnsInGrid)
        this.currList.push(this.origList[i]);
    }

  }
  addCol(c: ColumnSetting<any>) {
    this.columns.addCol(c);
    this.adjustColumns();
  }
  deleteCol(c: ColumnSetting<any>) {
    this.columns.deleteCol(c)
    this.adjustColumns();
  }
  adjustColumns() {
    this.columns.items.forEach(c => c.designMode = false);
    this.columns.numOfColumnsInGrid = this.columns.items.length;
  }

  private setGetOptions(get: FindOptionsPerEntity<rowType>) {
    this.getOptions = get;
    if (get && get.limit)
      this.rowsPerPage = get.limit;
    else
      this.rowsPerPage = 7;
    if (this.rowsPerPageOptions.indexOf(this.rowsPerPage) < 0) {
      this.rowsPerPageOptions.push(this.rowsPerPage);
      this.rowsPerPageOptions.sort((a, b) => +a - +b);
    }
    this._currentOrderBy = undefined;
    if (this.getOptions && this.getOptions.orderBy)
      this._currentOrderBy = extractSortFromSettings(this.entityProvider.create(), this.getOptions);

  }






  addNewRow() {
    let r: any = this.restList.add();
    this.columns.items.forEach(item => {
      if (item.defaultValue) {
        let result = item.defaultValue(r);
        if (result != undefined) {
          //r[item.key] = result;
        }

      }
    });
    if (this.onNewRow)
      this.onNewRow(r);
    this.setCurrentRow(r);
  }

  noam: string;

  addArea(settings: IDataAreaSettings<rowType>) {
    let col = new ColumnCollection<rowType>(() => this.currentRow, () => this.allowUpdate, this.filterHelper, () => this.currentRow ? true : false);
    col.numOfColumnsInGrid = 0;

    return new DataAreaSettings<rowType>(settings, col, this.entityProvider.create());
  }
  currentRow: rowType;
  setCurrentRow(row: rowType) {
    if (this.currentRow != row) {
      this.currentRow = row;
      if (this.onEnterRow && row) {

        this.onEnterRow(row);
      }
    }

  }
  nextRow() {
    if (!this.currentRow && this.items.length > 0)
      this.setCurrentRow(this.items[0]);
    if (this.currentRow) {
      let currentRowPosition = this.items.indexOf(this.currentRow);
      if (currentRowPosition < this.items.length - 1)
        this.setCurrentRow(this.items[currentRowPosition + 1]);
      else
        this.nextPage().then(() => {
          if (this.items.length > 0)
            this.setCurrentRow(this.items[0]);
        });
    }
  }
  previousRowAllowed() {
    return this.currentRow && this.items.indexOf(this.currentRow) > 0 || this.page > 1;
  }
  previousRow() {
    if (!this.previousRowAllowed())
      return;

    let currentRowPosition = this.items.indexOf(this.currentRow);
    if (currentRowPosition > 0)
      this.setCurrentRow(this.items[currentRowPosition - 1]);
    else {
      if (this.page > 1)
        this.previousPage().then(() => {
          if (this.items.length > 0)
            this.setCurrentRow(this.items[this.items.length - 1]);
        });
    }

  }
  deleteCurentRow() {
    if (!this.deleteCurrentRowAllowed)
      return;
    this.currentRowAsRestListItemRow().delete();
  }
  currentRowAsRestListItemRow() {
    if (!this.currentRow)
      return undefined;
    return <any>this.currentRow;
  }
  cancelCurrentRowChanges() {
    if (this.currentRowAsRestListItemRow() && this.currentRowAsRestListItemRow().reset)
      this.currentRowAsRestListItemRow().reset();
  }
  deleteCurrentRowAllowed() {
    return this.currentRowAsRestListItemRow() && this.currentRowAsRestListItemRow().delete && this.allowDelete && !isNewRow(this.currentRow);
  }
  currentRowChanged() {
    return this.currentRowAsRestListItemRow() && this.currentRowAsRestListItemRow().__wasChanged && this.currentRowAsRestListItemRow().__wasChanged();
  }
  saveCurrentRow() {
    if (this.currentRowAsRestListItemRow() && this.currentRowAsRestListItemRow().save)
      this.currentRowAsRestListItemRow().save();
  }

  allowUpdate = false;
  allowInsert = false;
  allowDelete = false;
  hideDataArea = false;


  _buttons: RowButton<Entity<any>>[] = [];

  rowClass?: (row: any) => string;
  onSavingRow?: (row: any) => Promise<any> | any;
  onValidate?: (row: rowType) => Promise<any> | any;
  onEnterRow: (row: rowType) => void;
  onNewRow: (row: rowType) => void;
  _doSavingRow(s: rowType) {
    return s.save(this.onValidate, this.onSavingRow);

  }
  caption: string;

  filterHelper = new FilterHelper<rowType>(() => {
    this.page = 1;
    this.getRecords();
  });

  columns: ColumnCollection<rowType>;




  page = 1;
  nextPage() {
    this.page++;
    return this.getRecords();
  }
  previousPage() {
    if (this.page <= 1)
      return;
    this.page--;
    return this.getRecords();
  }
  firstPage() {
    this.page = 1;
    return this.getRecords();
  }
  rowsPerPage: number;
  rowsPerPageOptions = [10, 25, 50, 100, 500, 1000];
  get(options: FindOptionsPerEntity<rowType>) {

    this.setGetOptions(options);
    this.page = 1;
    return this.getRecords();

  }

  _currentOrderBy: Sort;
  sort(column: Column<any>) {

    let done = false;
    if (this._currentOrderBy && this._currentOrderBy.Segments.length > 0) {
      if (this._currentOrderBy.Segments[0].column == column) {
        this._currentOrderBy.Segments[0].descending = !this._currentOrderBy.Segments[0].descending;
        done = true;
      }
    } if (!done)
      this._currentOrderBy = new Sort({ column: column });
    this.getRecords();
  }
  sortedAscending(column: Column<any>) {
    if (!this._currentOrderBy)
      return false;
    if (!column)
      return false;
    return this._currentOrderBy.Segments.length > 0 &&
      this._currentOrderBy.Segments[0].column == column &&
      !this._currentOrderBy.Segments[0].descending;
  }
  sortedDescending(column: Column<any>) {
    if (!this._currentOrderBy)
      return false;
    if (!column)
      return false;
    return this._currentOrderBy.Segments.length > 0 &&
      this._currentOrderBy.Segments[0].column == column &&
      !!this._currentOrderBy.Segments[0].descending;
  }



  private getOptions: FindOptionsPerEntity<rowType>;

  totalRows: number;

  getRecords() {

    let opt: FindOptionsPerEntity<rowType> = {};
    if (this.getOptions) {
      opt = Object.assign(opt, this.getOptions);
    }
    if (this._currentOrderBy)
      opt.orderBy = r => this._currentOrderBy;

    opt.limit = this.rowsPerPage;
    if (this.page > 1)
      opt.page = this.page;
    this.filterHelper.addToFindOptions(opt);

    let result = this.restList.get(opt).then(() => {


      if (this.restList.items.length == 0) {
        this.setCurrentRow(undefined);
        this.columns.autoGenerateColumnsBasedOnData(this.entityProvider.create());
      }
      else {


        this.setCurrentRow(this.restList.items[0]);
        this.columns.autoGenerateColumnsBasedOnData(this.entityProvider.create());
      }
      return this.restList;
    });
    if (this.settings && this.settings.knowTotalRows) {
      this.restList.count(opt.where).then(x => {
        this.totalRows = x;
      });
    }
    return result;
  };



  private restList: DataList<rowType>;
  get items(): rowType[] {
    if (this.restList)
      return this.restList.items;
    return undefined;
  }





}

export class FilterHelper<rowType extends Entity<any>> {
  filterRow: rowType;
  filterColumns: Column<any>[] = [];
  forceEqual: Column<any>[] = [];
  constructor(private reloadData: () => void) {

  }
  isFiltered(column: Column<any>) {
    return this.filterColumns.indexOf(column) >= 0;
  }
  filterColumn(column: Column<any>, clearFilter: boolean, forceEqual: boolean) {
    if (!column)
      return;
    if (clearFilter) {
      this.filterColumns.splice(this.filterColumns.indexOf(column, 1), 1);
      this.forceEqual.splice(this.forceEqual.indexOf(column, 1), 1);
    }
    else if (this.filterColumns.indexOf(column) < 0) {
      this.filterColumns.push(column);
      if (forceEqual)
        this.forceEqual.push(column);
    }
    this.reloadData();
  }
  addToFindOptions(opt: FindOptionsPerEntity<rowType>) {
    this.filterColumns.forEach(c => {

      let val = this.filterRow.__getColumn(c).value;
      let f: FilterBase = c.isEqualTo(val);
      if (c instanceof StringColumn) {
        let fe = this.forceEqual;
        if (fe.indexOf(c) < 0)
          f = c.isContains(val);
      }
      if (c instanceof DateTimeColumn) {
        if (val) {
          let v = DateTimeColumn.stringToDate(val);
          v = new Date(v.getFullYear(), v.getMonth(), v.getDate());

          f = c.isGreaterOrEqualTo(v).and(c.isLessThan((new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1))));

        }
      }

      if (opt.where) {
        let x = opt.where;
        opt.where = r => new AndFilter(x(r), f);
      }
      else opt.where = r => f;
    });
  }
}
export interface IDataSettings<rowType extends Entity<any>> {
  allowUpdate?: boolean,
  allowInsert?: boolean,
  allowDelete?: boolean,
  hideDataArea?: boolean,
  confirmDelete?: (r: rowType, yes: () => void) => void;

  columnSettings?: (row: rowType) => ColumnSetting<rowType>[],
  areas?: { [areaKey: string]: ColumnSetting<any>[] },

  rowCssClass?: (row: rowType) => string;
  rowButtons?: RowButton<rowType>[],
  get?: FindOptionsPerEntity<rowType>,
  knowTotalRows?: boolean,
  onSavingRow?: (r: rowType) => void;
  onValidate?: (r: rowType) => void;
  onEnterRow?: (r: rowType) => void;
  onNewRow?: (r: rowType) => void;
  numOfColumnsInGrid?: number;
  caption?: string;

}


export type rowEvent<T> = (row: T, doInScope: ((what: (() => void)) => void)) => void;

export interface ColumnSetting<rowType> {

  caption?: string;
  readonly?: boolean;
  inputType?: string;
  designMode?: boolean;
  getValue?: (row: rowType) => any;
  hideDataOnInput?: boolean;
  cssClass?: (string | ((row: rowType) => string));
  defaultValue?: (row: rowType) => any;
  onUserChangedValue?: (row: rowType) => void;
  click?: rowEvent<rowType>;
  allowClick?: (row: rowType) => boolean;
  clickIcon?: string;
  dropDown?: DropDownOptions;
  column?: Column<any>;
  width?: string;
}



export interface FilteredColumnSetting<rowType> extends ColumnSetting<rowType> {
  _showFilter?: boolean;
}

export interface RowButton<rowType extends Entity<any>> {
  name?: string;
  visible?: (r: rowType) => boolean;
  click?: (r: rowType) => void;
  icon?: string;
  cssClass?: (string | ((row: rowType) => string));

}





function onSuccess(response: Response) {

  if (response.status >= 200 && response.status < 300)
    return response.json();
  else throw response;

}
function onError(error: any) {
  throw error;
}





export function isNewRow(r: Entity<any>) {
  if (r) {
    r.__entityData.isNewRow();
  }
  return false;
}





export class DataList<T extends Entity<any>> implements Iterable<T>{
  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }


  items: T[] = [];
  constructor(private entityProvider: EntityProvider<T>) {

  }

  _rowReplacedListeners: ((oldRow: T, newRow: T) => void)[] = [];

  private map(item: T): T {

    item.__entityData.register({
      rowReset: (newRow) => {
        if (newRow)
          this.items.splice(this.items.indexOf(item), 1);

      },
      rowDeleted: () => { this.items.splice(this.items.indexOf(item), 1) }
    });
    return item;
  }
  lastGetId = 0;
  count(where?: (rowType: T) => FilterBase) {
    return this.entityProvider.count(where);
  }
  get(options?: FindOptionsPerEntity<T>) {

    let getId = ++this.lastGetId;

    return this.entityProvider.find(options).then(r => {
      let x: T[] = r;
      let result = r.map((x: any) => this.map(x));
      if (getId == this.lastGetId)
        this.items = result;
      return result;
    });
  }
  add(): T {
    let x = this.map(this.entityProvider.create());
    this.items.push(x);
    return x;
  }

}


export class Sort {
  constructor(...segments: SortSegment[]) {

    this.Segments = segments;
  }
  Segments: SortSegment[];
}
export interface SortSegment {
  column: Column<any>,
  descending?: boolean
}

export class Lookup<lookupIdType, entityType extends Entity<lookupIdType>> {

  constructor(private entity: entityType, private entityProvider: EntityProvider<entityType>) {
    this.restList = new DataList<entityType>(entityProvider);

  }

  private restList: DataList<entityType>;
  private cache: any = {};

  get(filter: Column<lookupIdType> | ((entityType: entityType) => FilterBase)): entityType {
    return this.getInternal(filter).value;
  }
  found(filter: Column<lookupIdType> | ((entityType: entityType) => FilterBase)): boolean {
    return this.getInternal(filter).found;
  }

  private getInternal(filter: Column<lookupIdType> | ((entityType: entityType) => FilterBase)): lookupRowInfo<entityType> {
    let find: FindOptionsPerEntity<entityType> = {};
    if (filter instanceof Column)
      find.where = (e) => e.__idColumn.isEqualTo(filter);
    else if (isFunction(filter)) {
      find.where = e => filter(e);
    }


    return this._internalGetByOptions(find);
  }

  _internalGetByOptions(find: FindOptionsPerEntity<entityType>): lookupRowInfo<entityType> {

    let key = "";
    let url = new UrlBuilder("");
    if (find.where)
      find.where(this.entity).__applyToConsumer(new FilterConsumnerBridgeToUrlBuilder(url));
    key = url.url;

    if (this.cache == undefined)
      this.cache = {};
    if (this.cache[key]) {
      return this.cache[key];
    } else {
      let res = new lookupRowInfo<entityType>();
      this.cache[key] = res;

      if (find == undefined || key == undefined) {
        res.loading = false;
        res.found = false;
        return res;
      } else {
        res.value = <entityType>this.entityProvider.create();
        res.promise = this.restList.get(find).then(r => {
          res.loading = false;
          if (r.length > 0) {
            res.value = r[0];
            res.found = true;
          }
          return res;
        });
      }
      return res;
    }
  }

  whenGet(filter: Column<lookupIdType> | ((entityType: entityType) => FilterBase)) {
    return this.getInternal(filter).promise.then(r => r.value);
  }
}

export class UrlBuilder {
  constructor(public url: string) {
  }
  add(key: string, value: any) {
    if (this.url.indexOf('?') >= 0)
      this.url += '&';
    else
      this.url += '?';
    this.url += encodeURIComponent(key) + '=' + encodeURIComponent(value);
  }
  addObject(object: any, suffix = '') {
    if (object != undefined)
      for (var key in object) {
        let val = object[key];
        if (val instanceof Column)
          val = val.value;
        this.add(key + suffix, val);
      }
  }
}

export class FilterConsumnerBridgeToUrlBuilder implements FilterConsumer {
  constructor(private url: UrlBuilder) {

  }

  public isEqualTo(col: Column<any>, val: any): void {
    this.url.add(col.jsonName, val);
  }

  public isDifferentFrom(col: Column<any>, val: any): void {
    this.url.add(col.jsonName + '_ne', val);
  }

  public isGreaterOrEqualTo(col: Column<any>, val: any): void {
    this.url.add(col.jsonName + '_gte', val);
  }

  public isGreaterThan(col: Column<any>, val: any): void {
    this.url.add(col.jsonName + '_gt', val);
  }

  public isLessOrEqualTo(col: Column<any>, val: any): void {
    this.url.add(col.jsonName + '_lte', val);
  }

  public isLessThan(col: Column<any>, val: any): void {
    this.url.add(col.jsonName + '_lt', val);
  }
  public isContains(col: StringColumn, val: any): void {
    this.url.add(col.jsonName + "_contains", val);
  }
  public isStartsWith(col: StringColumn, val: any): void {
    this.url.add(col.jsonName + "_st", val);
  }
}

export class lookupRowInfo<type> {
  found = false;
  loading = true;
  value: type = {} as type;
  promise: Promise<lookupRowInfo<type>>

}

export class DefaultStorage<dataType> implements ColumnStorage<dataType>{
  toDb(val: dataType) {
    return val;
  }
  fromDb(val: any): dataType {
    return val;
  }

}
export class DateTimeDateStorage implements ColumnStorage<string>{
  toDb(val: string) {

    return DateColumn.stringToDate(val);
  }
  fromDb(val: any): string {
    var d = val as Date;
    return DateColumn.dateToString(d);
  }

}
export class CharDateStorage implements ColumnStorage<string> {
  toDb(val: string) {
    return val.replace(/-/g, '');
  }
  fromDb(val: any): string {
    return val.substring(0, 4) + '-' + val.substring(4, 6) + '-' + val.substring(6, 8);
  }
}
export class DateTimeStorage implements ColumnStorage<string>{
  toDb(val: string) {
    return DateTimeColumn.stringToDate(val);
  }
  fromDb(val: any): string {
    var d = val as Date;
    return DateTimeColumn.dateToString(d);
  }

}
function addZeros(number: number, stringLength: number = 2) {
  let to = number.toString();
  while (to.length < stringLength)
    to = '0' + to;
  return to;
}



export class Filter implements FilterBase {
  constructor(private apply: (add: FilterConsumer) => void) {

  }
  and(filter: FilterBase): AndFilter {
    return new AndFilter(this, filter);
  }

  public __applyToConsumer(add: FilterConsumer): void {
    this.apply(add);
  }
}



export class AndFilter implements FilterBase {
  constructor(private a: FilterBase, private b: FilterBase) {

  }
  and(filter: FilterBase): AndFilter {
    return new AndFilter(this, filter);
  }

  public __applyToConsumer(add: FilterConsumer): void {
    if (this.a)
      this.a.__applyToConsumer(add);
    if (this.b)
      this.b.__applyToConsumer(add);
  }
}
export interface EntityOptions {
  name: string;
  dbName?: string | (() => string);
  caption?: string;
  allowApiRead?: Allowed;
  allowApiUpdate?: Allowed;
  allowApiDelete?: Allowed;
  allowApiInsert?: Allowed;
  allowApiCRUD?: Allowed;
  apiDataFilter?: () => FilterBase;
  onSavingRow?: () => Promise<any> | any;

  onValidate?: (e: Entity<any>) => Promise<any> | any;
}
//@dynamic
export class Entity<idType> {
  constructor(options?: EntityOptions | string) {
    if (options) {
      if (typeof (options) === "string") {
        this.__options = { name: options };
      } else {
        this.__options = options;
        if (options.onSavingRow)
          this.__onSavingRow = () => options.onSavingRow();
        if (options.onValidate)
          this.__onValidate = () => options.onValidate(this);
      }
    }
    else {
      this.__options = {
        name: undefined
      };
    }
  }

  static __key: string;


  _getExcludedColumns(x: Entity<any>, context: Context) {
    let r = x.__iterateColumns().filter(c => {
      return !context.isAllowed(c.includeInApi);
    });
    return r;
  }
  _getEntityApiSettings(r: Context): DataApiSettings<Entity<any>> {

    let options = this.__options;
    if (options.allowApiCRUD) {
      options.allowApiDelete = true;
      options.allowApiInsert = true;
      options.allowApiUpdate = true;
    }
    return {
      allowRead: r.isAllowed(options.allowApiRead),
      allowUpdate: r.isAllowed(options.allowApiUpdate),
      allowDelete: r.isAllowed(options.allowApiDelete),
      allowInsert: r.isAllowed(options.allowApiInsert),
      excludeColumns: x =>
        this._getExcludedColumns(x, r)
      ,
      readonlyColumns: x => {
        return x.__iterateColumns().filter(c => !r.isAllowed(c.allowApiUpdate));
      },
      get: {
        where: x => options.apiDataFilter ? options.apiDataFilter() : undefined
      }
    }

  }

  __options: EntityOptions;


  __getName() {
    return this.__options.name;
  }
  __getDbName() {
    if (!this.__options.dbName)
      this.__options.dbName = this.__getName();
    return functionOrString(this.__options.dbName);
  }
  __getCaption() {
    if (!this.__options.caption) {
      this.__options.caption = makeTitle(this.__getName());
    }
    return this.__options.caption;
  }

  __entityData = new __EntityValueProvider();

  //@internal
  __onSavingRow: () => void | Promise<void> = () => { };
  //@internal
  __onValidate: () => void | Promise<void> = () => { };

  error: string;
  __idColumn: Column<idType>;

  __initColumns(idColumn?: Column<idType>) {
    if (idColumn)
      this.__idColumn = idColumn;
    let x = <any>this;
    for (let c in x) {
      let y = x[c];

      if (y instanceof Column) {
        if (!y.jsonName)
          y.jsonName = c;
        if (!this.__idColumn && y.jsonName == 'id')
          this.__idColumn = y;


        this.__applyColumn(y);
      }
    }
    if (!this.__idColumn)
      this.__idColumn = this.__iterateColumns()[0];
  }
  isValid() {
    let ok = true;
    this.__iterateColumns().forEach(c => {
      if (c.error)
        ok = false;
    });
    return ok;
  }
  isNew() {
    return this.__entityData.isNewRow();
  }

  __getValidationError() {
    let result: any = {};
    result.modelState = {};
    this.__iterateColumns().forEach(c => {
      if (c.error)
        result.modelState[c.jsonName] = c.error;
    });
    return result;
  }


  __assertValidity() {
    if (!this.isValid()) {

      throw this.__getValidationError();
    }
  }
  save(validate?: (row: this) => Promise<any> | any, onSavingRow?: (row: this) => Promise<any> | any) {
    this.__clearErrors();

    this.__iterateColumns().forEach(c => {
      c.__performValidation();
    });

    if (this.__onValidate)
      this.__onValidate();
    if (validate)
      validate(this);
    this.__assertValidity();


    let performEntitySave = () => {
      let x = this.__onSavingRow();

      let doSave = () => {
        this.__assertValidity();


        return this.__entityData.save(this).catch(e => this.catchSaveErrors(e));
      };
      if (x instanceof Promise) {

        return x.then(() => {
          return doSave();
        });
      }
      else {

        return doSave();
      }
    }

    if (!onSavingRow)
      return performEntitySave();
    let y = onSavingRow(this);
    if (y instanceof Promise) {
      return y.then(() => { return performEntitySave(); });
    }
    return performEntitySave();
  }
  catchSaveErrors(err: any): any {
    let e = err;
    if (e instanceof Promise) {
      return e.then(x => this.catchSaveErrors(x));
    }
    if (e.error) {
      e = e.error;
    }

    if (e.message)
      this.error = e.message;
    else if (e.Message)
      this.error = e.Message;
    else this.error = e;
    let s = e.modelState;
    if (!s)
      s = e.ModelState;
    if (s) {
      Object.keys(s).forEach(k => {
        let c = this.__getColumnByJsonName(k);
        if (c)
          c.error = s[k];
      });
    }
    throw err;

  }

  delete() {
    return this.__entityData.delete().catch(e => this.catchSaveErrors(e));

  }
  reset() {
    this.__entityData.reset();
    this.__clearErrors();
  }
  //@internal
  __clearErrors() {
    this.__iterateColumns().forEach(c => c.__clearErrors());
    this.error = undefined;
  }
  wasChanged() {
    return this.__entityData.wasChanged();
  }
  async __toPojo(excludeColumns: ColumnHashSet): Promise<any> {
    let r = {};
    await Promise.all(this.__iterateColumns().map(async c => {
      await c.__calcVirtuals();
    }));
    this.__iterateColumns().forEach(c => {
      if (!excludeColumns.contains(c))
        c.__addToPojo(r);
    });
    return r;

  }

  __fromPojo(r: any, excludeColumns: ColumnHashSet): any {

    this.__iterateColumns().forEach(c => {
      if (!excludeColumns.contains(c))
        c.__loadFromToPojo(r);
    });


  }


  //@internal
  __applyColumn(y: Column<any>) {
    if (!y.caption)
      y.caption = makeTitle(y.jsonName);
    y.__valueProvider = this.__entityData;
    if (this.__columns.indexOf(y) < 0)
      this.__columns.push(y);
    y.__setEntity(this);
  }
  //@internal
  __columns: Column<any>[] = [];
  __getColumn<T>(col: Column<T>) {

    return this.__getColumnByJsonName(col.jsonName);
  }
  __getColumnByJsonName(key: string): Column<any> {
    let result: Column<any>;
    this.__iterateColumns().forEach(c => {
      if (c.jsonName == key)
        result = c;
    });
    return result;
  }
  __iterateColumns() {
    return this.__columns;

  }


}
export class ColumnHashSet {
  private _names: string[] = [];
  add(...columns: Column<any>[]) {
    if (columns)
      for (let c of columns)
        this._names.push(c.__getMemberName());
  }
  contains(column: Column<any>) {
    return this._names.indexOf(column.__getMemberName()) >= 0;
  }
}
export interface LookupCache<T extends Entity<any>> {
  key: string;
  lookup: Lookup<any, T>;
}

export class CompoundIdColumn extends Column<string>
{
  private columns: Column<any>[];
  constructor(entity: Entity<string>, ...columns: Column<any>[]) {
    super();
    this.columns = columns;
  }
  __isVirtual() { return true; }
  isEqualTo(value: Column<string> | string): Filter {
    return new Filter(add => {
      let val = this.__getVal(value);
      let id = val.split(',');
      let result: FilterBase;
      this.columns.forEach((c, i) => {
        if (!result)
          result = c.isEqualTo(id[i]);
        else
          result = new AndFilter(result, c.isEqualTo(id[i]));
      });
      return result.__applyToConsumer(add);
    });
  }
  __addIdToPojo(p: any) {
    if (p.id)
      return;
    let r = "";
    this.columns.forEach(c => {
      if (r.length > 0)
        r += ',';
      r += p[c.jsonName];
    });
    p.id = r;

  }
  resultIdFilter(id: string, data: any) {
    return new Filter(add => {
      let idParts: any[] = [];
      if (id != undefined)
        idParts = id.split(',');
      let result: FilterBase;
      this.columns.forEach((c, i) => {
        let val = undefined;
        if (i < idParts.length)
          val = idParts[i];
        if (data[c.jsonName] != undefined)
          val = data[c.jsonName];
        if (!result)
          result = c.isEqualTo(val);
        else
          result = new AndFilter(result, c.isEqualTo(val));
      });
      return result.__applyToConsumer(add);
    });
  }
}


export class __EntityValueProvider implements ColumnValueProvider {
  listeners: RowEvents[] = [];
  register(listener: RowEvents) {
    this.listeners.push(listener);
  }
  dataProvider: EntityDataProvider;
  delete() {
    return this.dataProvider.delete(this.id).then(() => {
      this.listeners.forEach(x => {
        if (x.rowDeleted)
          x.rowDeleted();
      });
    });
  }

  isNewRow(): boolean {
    return this.newRow;
  }
  wasChanged() {
    return JSON.stringify(this.originalData) != JSON.stringify(this.data) || this.newRow;

  }
  reset(): void {
    this.data = JSON.parse(JSON.stringify(this.originalData));
    this.listeners.forEach(x => {
      if (x.rowReset)
        x.rowReset(this.newRow);
    });
  }
  save(e: Entity<any>): Promise<void> {
    let d = JSON.parse(JSON.stringify(this.data));
    if (e.__idColumn instanceof CompoundIdColumn)
      d.id = undefined;
    if (this.newRow) {
      return this.dataProvider.insert(d).then((newData: any) => {
        this.setData(newData, e);
        this.listeners.forEach(x => {
          if (x.rowSaved)
            x.rowSaved(true);
        });
      });
    } else {
      return this.dataProvider.update(this.id, d).then((newData: any) => {
        this.setData(newData, e);
        this.listeners.forEach(x => {
          if (x.rowSaved)
            x.rowSaved(false);
        });
      });

    }
  }
  private id: any;
  private newRow = true;
  private data: any = {};
  private originalData: any = {};


  setData(data: any, r: Entity<any>) {
    if (!data)
      data = {};
    if (r.__idColumn instanceof CompoundIdColumn) {
      r.__idColumn.__addIdToPojo(data);
    }
    let id = data[r.__idColumn.jsonName];
    if (id != undefined) {
      this.id = id;
      this.newRow = false;
    }

    this.data = data;
    this.originalData = JSON.parse(JSON.stringify(this.data));
  }
  getValue(key: string) {
    return this.data[key];
  }
  getOriginalValue(key: string) {
    return this.originalData[key];
  }
  setValue(key: string, value: any): void {
    this.data[key] = value;
  }
}
export class StringColumn extends Column<string>{
 
  isContains(value: StringColumn | string) {
    return new Filter(add => add.isContains(this, this.__getVal(value)));
  }
  isStartsWith(value: StringColumn | string) {
    return new Filter(add => add.isStartsWith(this, this.__getVal(value)));
  }
}
export class DateColumn extends Column<Date>{
  constructor(settingsOrCaption?: ColumnOptions<Date>) {
    super(settingsOrCaption);
    if (!this.inputType)
      this.inputType = 'date';
  }
  getDayOfWeek() {
    return new Date(this.value).getDay();
  }
  get displayValue() {
    if (!this.value)
      return '';
    return this.value.toLocaleDateString();
  }
  __defaultStorage() {
    return new DateTimeDateStorage();
  }
  toRawValue(value: Date) {
    return DateColumn.dateToString(value);
  }
  fromRawValue(value: any) {

    return DateColumn.stringToDate(value);
  }

  static stringToDate(value: string) {
    if (!value || value == '' || value == '0000-00-00')
      return undefined;
    return new Date(Date.parse(value));
  }
  static dateToString(val: Date): string {
    var d = val as Date;
    if (!d)
      return '';
    let month = addZeros(d.getMonth() + 1),
      day = addZeros(d.getDate()),
      year = d.getFullYear();
    return [year, month, day].join('-');
  }

}
export class DateTimeColumn extends Column<Date>{
  constructor(settingsOrCaption?: ColumnOptions<Date>) {
    super(settingsOrCaption);
    if (!this.inputType)
      this.inputType = 'date';
  }
  getDayOfWeek() {
    return this.value.getDay();
  }
  get displayValue() {
    if (!this.value)
      return '';
    return this.value.toLocaleString();
  }
  __defaultStorage() {
    return new DateTimeStorage();
  }
  fromRawValue(value: any) {
    return DateTimeColumn.stringToDate(value);
  }
  toRawValue(value: Date) {
    return DateTimeColumn.dateToString(value);
  }

  static stringToDate(val: string) {
    if (val == undefined)
      return undefined;
    if (val == '')
      return undefined;
    if (val.startsWith('0000-00-00'))
      return undefined;
    return new Date(Date.parse(val));
  }
  static dateToString(val: Date): string {
    var d = val as Date;
    if (!d)
      return '';
    return d.toISOString();
  }


}



export class NumberColumn extends Column<number>{
  constructor(settingsOrCaption?: NumberColumnOptions) {
    super(settingsOrCaption);
    if (!this.inputType)
      this.inputType = 'number';
    let s = settingsOrCaption as NumberColumnSettings;
    if (s && s.decimalDigits) {
      this.__numOfDecimalDigits = s.decimalDigits;
    }
  }
  __numOfDecimalDigits: number = 0;
  protected __processValue(value: number) {

    if (value != undefined && !(typeof value === "number"))
      return +value;
    return value;

  }
}
export interface NumberColumnSettings extends DataColumnSettings<number> {
  decimalDigits?: number;
}
export declare type NumberColumnOptions = NumberColumnSettings | string;
export class BoolColumn extends Column<boolean>{
  constructor(settingsOrCaption?: ColumnOptions<boolean>) {
    super(settingsOrCaption);
    if (!this.inputType)
      this.inputType = 'checkbox';
  }
  __defaultStorage() {
    return new BoolStorage();
  }
}

export class BoolStorage implements ColumnStorage<any>{
  toDb(val: any) {
    return val;
  }
  fromDb(val: any): any {
    if (isString(val))
      return val === "true";
    return val;
  }

}

export interface ClosedListItem {
  id: number;
  toString(): string;
}
export class ClosedListColumn<closedListType extends ClosedListItem> extends Column<closedListType> {
  constructor(private closedListType: any, settingsOrCaption?: ColumnOptions<closedListType>,settingsOrCaption1?: ColumnOptions<closedListType>) {
    super(settingsOrCaption,settingsOrCaption1);
  }
  getOptions(): DropDownItem[] {
    let result = [];
    for (let member in this.closedListType) {
      let s = this.closedListType[member] as closedListType;
      if (s && s.id != undefined) {
        result.push({
          id: s.id,
          caption: s.toString()
        })
      }
    }
    return result;
  }
  toRawValue(value: closedListType) {
    return value.id;
  }
  fromRawValue(value: any) {
    return this.byId(+value);
  }

  get displayValue() {
    if (this.value)
      return this.value.toString();
    return '';
  }
  byId(id: number): closedListType {
    for (let member in this.closedListType) {
      let s = this.closedListType[member] as closedListType;
      if (s && s.id == id)
        return s;
    }
    return undefined;
  }
}
export class ColumnCollection<rowType extends Entity<any>> {
  constructor(public currentRow: () => Entity<any>, private allowUpdate: () => boolean, public filterHelper: FilterHelper<rowType>, private showArea: () => boolean, private context?: Context) {

    if (this.allowDesignMode == undefined) {
      if (location.search)
        if (location.search.toLowerCase().indexOf('design=y') >= 0)
          this.allowDesignMode = true;
    }
  }
  __showArea() {
    return this.showArea();

  }
  __getColumn(map: ColumnSetting<any>, record: Entity<any>) {
    let result: Column<any>;
    if (record)
      result = record.__getColumn(map.column);
    if (!result)
      result = map.column;
    return result;
  }
  __dataControlStyle(map: ColumnSetting<any>): string {

    if (map.width && map.width.trim().length > 0) {
      if ((+map.width).toString() == map.width)
        return map.width + "px";
      return map.width;
    }
    return undefined;

  }
  private settingsByKey: any = {};

  allowDesignMode: boolean;
  async add(...columns: ColumnSetting<rowType>[]): Promise<void>;
  async add(...columns: string[]): Promise<void>;
  async add(...columns: any[]) {
    var promises: Promise<void>[] = [];
    for (let c of columns) {
      if (!c)
        continue;
      let s: ColumnSetting<rowType>;
      let x = c as ColumnSetting<rowType>;
      if (!x.column && c instanceof Column) {
        x = {
          column: c,
        }

      }
      if (x.column) {
        x.column.__decorateDataSettings(x);
      }

      if (x.getValue) {
        s = x;
      }

      else {
        promises.push(this.buildDropDown(x));
      }
      this.items.push(x);


    }
    await Promise.all(promises);
    return Promise.resolve();
  }
  async buildDropDown(s: ColumnSetting<any>) {
    if (s.dropDown) {
      let orig = s.dropDown.items;
      let result: DropDownItem[] = [];
      s.dropDown.items = result;

      if (orig instanceof Array) {
        for (let item of orig) {
          let type = typeof (item);
          if (type == "string" || type == "number")
            result.push({ id: item, caption: item });
          else {
            let x = item as DropDownItem;
            if (x && x.id != undefined) {
              result.push(x);
            }
          }
        }
      }
      else if (s.dropDown.source) {
        result.push(...(await s.dropDown.source.provideItems()));
      }
    }
    return Promise.resolve();
  }

  designMode = false;
  colListChanged() {
    this._lastNumOfColumnsInGrid = -1;
    this._colListChangeListeners.forEach(x => x());
  };
  _colListChangeListeners: (() => void)[] = [];
  onColListChange(action: (() => void)) {
    this._colListChangeListeners.push(action);
  }
  moveCol(col: ColumnSetting<any>, move: number) {
    let currentIndex = this.items.indexOf(col);
    let newIndex = currentIndex + move;
    if (newIndex < 0 || newIndex >= this.items.length)
      return;
    this.items.splice(currentIndex, 1);
    this.items.splice(newIndex, 0, col);
    this.colListChanged();


  }

  filterRows(col: FilteredColumnSetting<any>) {
    col._showFilter = false;
    this.filterHelper.filterColumn(col.column, false, (col.dropDown != undefined || col.click != undefined));
  }
  clearFilter(col: FilteredColumnSetting<any>) {
    col._showFilter = false;
    this.filterHelper.filterColumn(col.column, true, false);
  }
  _shouldShowFilterDialog(col: FilteredColumnSetting<any>) {
    return col && col._showFilter;
  }
  showFilterDialog(col: FilteredColumnSetting<any>) {
    col._showFilter = !col._showFilter;
  }
  deleteCol(col: ColumnSetting<any>) {
    this.items.splice(this.items.indexOf(col), 1);
    this.colListChanged();
  }
  addCol(col: ColumnSetting<any>) {
    this.items.splice(this.items.indexOf(col) + 1, 0, { designMode: true });
    this.colListChanged();
  }
  designColumn(col: ColumnSetting<any>) {
    col.designMode = !col.designMode;
  }

  _getEditable(col: ColumnSetting<any>) {
    if (!this.allowUpdate())
      return false;
    if (!col.column)
      return false
    return !col.readonly;
  }
  _click(col: ColumnSetting<any>, row: any) {
    col.click(row, what => {
      what();
    });
  }

  _getColDisplayValue(col: ColumnSetting<any>, row: rowType) {
    let r;
    if (col.getValue) {

      r = col.getValue(row)
      if (r instanceof Column)
        r = r.value;



    }
    else if (col.column) {
      if (col.dropDown && col.dropDown.items) {
        for (let x of col.dropDown.items) {
          if (x.id == this.__getColumn(col, row).value)
            return x.caption;
        }
      }
      r = this.__getColumn(col, row).displayValue;
    }


    return r;
  }
  _getColDataType(col: ColumnSetting<any>) {
    if (col.inputType)
      return col.inputType;
    return "text";
  }
  _getColumnClass(col: ColumnSetting<any>, row: any) {

    if (col.cssClass)
      if (isFunction(col.cssClass)) {
        let anyFunc: any = col.cssClass;
        return anyFunc(row);
      }
      else return col.cssClass;
    return '';

  }

  _getError(col: ColumnSetting<any>, r: Entity<any>) {
    if (!col.column)
      return undefined;
    return this.__getColumn(col, r).error;
  }
  autoGenerateColumnsBasedOnData(r: Entity<any>) {
    if (this.items.length == 0) {

      if (r) {
        this.add(...r.__iterateColumns());

      }
    }



  }
  __columnSettingsTypeScript() {
    let memberName = 'x';
    if (this.currentRow())
      memberName = this.currentRow().__getName();
    memberName = memberName[0].toLocaleLowerCase() + memberName.substring(1);
    let result = ''

    this.items.forEach(c => {
      if (result.length > 0)
        result += ',\n';

      result += '  ' + this.__columnTypeScriptDescription(c, memberName);

    });
    result = `columnSettings: ${memberName} => [\n` + result + "\n]";
    return result;
  }
  __columnTypeScriptDescription(c: ColumnSetting<any>, memberName: string) {
    let properties = "";
    function addToProperties(name: string, value: any) {
      if (properties.length > 0)
        properties += ', ';
      properties += "\n    " + name + ": " + value;
    }
    function addString(name: string, value: string) {
      addToProperties(name, "'" + value + "'");

    }
    let columnMember = '';
    if (c.column) {
      columnMember += memberName + "." + c.column.__getMemberName();
      if (c == c.column)
        columnMember += '/*equal*/';
      if (c.caption != c.column.caption) {
        addString('caption', c.caption)
      }

    } else {
      addString('caption', c.caption);
    }
    if (c.width && c.width.length > 0)
      addString('width', c.width);
    if (properties.length > 0) {
      if (columnMember != '') {
        properties = '\n    column: ' + columnMember + ', ' + properties;
      }
    }
    let whatToAdd = '';
    if (properties.length > 0)
      whatToAdd = "{" + properties + "\n  }";
    else if (columnMember != '')
      whatToAdd = columnMember;
    return whatToAdd;
  }
  __changeWidth(col: ColumnSetting<any>, what: number) {
    let width = col.width;
    if (!width)
      width = '50';
    width = ((+width) + what).toString();
    col.width = width;
  }
  _colValueChanged(col: ColumnSetting<any>, r: any) {

    if (col.onUserChangedValue)
      col.onUserChangedValue(r);

  }
  items: ColumnSetting<any>[] = [];
  private gridColumns: ColumnSetting<any>[];
  private nonGridColumns: ColumnSetting<any>[];
  numOfColumnsInGrid = 5;

  private _lastColumnCount: number;
  private _lastNumOfColumnsInGrid: number;
  private _initColumnsArrays() {
    if (this._lastColumnCount != this.items.length || this._lastNumOfColumnsInGrid != this.numOfColumnsInGrid) {
      this._lastNumOfColumnsInGrid = this.numOfColumnsInGrid;
      this._lastColumnCount = this.items.length;
      this.gridColumns = [];
      this.nonGridColumns = [];
      let i = 0;
      for (let c of this.items) {
        if (i++ < this._lastNumOfColumnsInGrid)
          this.gridColumns.push(c);
        else
          this.nonGridColumns.push(c);
      }
    }
  }
  getGridColumns() {
    this._initColumnsArrays();
    return this.gridColumns;
  }
  getNonGridColumns() {
    this._initColumnsArrays();
    return this.nonGridColumns;
  }
}
export function extractSortFromSettings<T extends Entity<any>>(entity: T, opt: FindOptionsPerEntity<T>): Sort {
  if (!opt)
    return undefined;
  if (!opt.orderBy)
    return undefined;
  let x = opt.orderBy(entity);
  return translateSort(x);

}
export function translateSort(sort: any): Sort {
  if (sort instanceof Sort)
    return sort;
  if (sort instanceof Column)
    return new Sort({ column: sort });
  if (sort instanceof Array) {
    let r = new Sort();
    sort.forEach(i => {
      if (i instanceof Column)
        r.Segments.push({ column: i });
      else r.Segments.push(i);
    });
    return r;
  }
}
export interface SQLCommand {
  addParameterToCommandAndReturnParameterName(col: Column<any>, val: any): string;
  query(sql: string): Promise<SQLQueryResult>;
}
export interface SQLQueryResult {
  rows: any[];
  getColumnIndex(name: string): number;
  getcolumnNameAtIndex(index: number): string;
}



export interface SQLConnectionProvider {
  createCommand(): SQLCommand;
}
export interface SupportsDirectSql {
  getDirectSql(): DirectSQL;
}

export class FilterConsumerBridgeToSqlRequest implements FilterConsumer {
  where = "";
  constructor(private r: SQLCommand) { }
  isEqualTo(col: Column<any>, val: any): void {
    this.add(col, val, "=");
  }
  isDifferentFrom(col: Column<any>, val: any): void {
    this.add(col, val, "<>");
  }
  isGreaterOrEqualTo(col: Column<any>, val: any): void {
    this.add(col, val, ">=");
  }
  isGreaterThan(col: Column<any>, val: any): void {
    this.add(col, val, ">");
  }
  isLessOrEqualTo(col: Column<any>, val: any): void {
    this.add(col, val, "<=");
  }
  isLessThan(col: Column<any>, val: any): void {
    this.add(col, val, "<");
  }
  public isContains(col: StringColumn, val: any): void {
    this.add(col, '%' + val + '%', 'like');
  }
  public isStartsWith(col: StringColumn, val: any): void {
    this.add(col, val + '%', 'like');
  }
  private add(col: Column<any>, val: any, operator: string) {
    if (this.where.length == 0) {

      this.where += ' where ';
    } else this.where += ' and ';
    this.where += col.__getDbName() + ' ' + operator + ' ' + this.r.addParameterToCommandAndReturnParameterName(col, val);

  }





}