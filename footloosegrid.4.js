/* FootlooseGrid - v3.0 - 2015-12-26
 * https://github.com/johngrib/FootlooseGrid
 * Copyright 2015 Lee JongRip (이종립, a.k.a. John Grib) and other contributors; 
 * Licensed MIT 
 */

/* jshint laxcomma: true*/
"use strict";

/** 퍼포먼스 테스트를 위한 time count 펑션. console.time 과 용법은 같다 */
function time_start (msg){ return (time_start[msg] = new Date().getTime()); }

/** 퍼포먼스 테스트를 위한 time_end 펑션. console. timeEnd 와는 달리 카운트한 시간의 number 를 리턴한다 */
function time_end(msg){
  const result = new Date().getTime() - time_start[msg];
  console.log(`${msg} : ${result}`);
  return result;}

var footloosegrid = (function _create_footloosegrid_function($){

// support functions

  // second argument 를 bind 해주는 curry function
  function _curry_2_(func, param2) { 
    return (param1) => func(param1, param2); 
  }

  // getter 생성기
  function _make_const_getter(v) {
    return () => v ;
  }

  // parseInt wrapped
  const _toInt = _curry_2_(parseInt, 10);
  
  function _is_number (value) {
    return typeof value === 'number' && isFinite(value);
  }
  /**
   * 숫자 형식의 문자열 판별
   * 정수와 실수는 true 를 리턴하며, 과학 표기법은 false 를 리턴한다
   * @returns {Boolean}
   */
  const _is_number_str = (() => {
    const reg = /^\s*-?\d+(?:\.\d+)?\s*$/;
    return (str) => reg.test(str);
  })();

  /**
   * 숫자에 콤마를 넣어 문자열로 리턴해 준다
   * @returns {String}
   */
  const _to_comma_format = (() => {
    const reg = /\B(?=(\d{3})+(?!\d))/g;
    return (num) => {
      if(num == null)
        return num;

      const v   = num.toString();
      const dot = v.indexOf('.');

      if(dot >= 0){
        const tail = v.slice(dot);
        const head = v.slice(0, dot);
        return head.replace(reg, ",") + tail;
      } else {
        return v.replace(reg, ",");
      }
    };
  })();

  /** default_obj 에 존재하는 key/value 값이 target_obj 에 존재하지 않는다면 해당 key/value 값을 복사해 입력해 준다 */
  function _insert_undefined_values(target_obj, default_obj) { 
    for(var key in default_obj)
      if(target_obj[key] === undefined)
        target_obj[key] = default_obj[key];
    return target_obj; };
  
  /** event interceptor 를 부착해주는 function creator */
  FGR.prototype.set_interceptor = function set_interceptor (target, interceptor, _this) {
    return (...args) => {
      interceptor.apply(_this, args);
      return target.apply(_this, args); 
    };
  };
      
  function _sum_func(a, b) { 
    return a + b; 
  };
  
// end of support functions ------------------------------------------------------------

/**
 * Internet Explorer 버전 체크
 * ※ IE 11 버전부터는 cc_on 문이 작동하지 않으므로, ie 값이 false 가 된다.
 * @returns {Boolean}
 * @link https://msdn.microsoft.com/library/8ka90k2e(v=vs.94).aspx
 */
function _check_ie_version(){
  var version = -1;
/*@cc_on
  @if   (@_jscript_version == 10)
    version = 10;
  @elif (@_jscript_version == 9)
    version = 9;
  @elif (@_jscript_version == 5.8)
    version = 8;
  @end
@*/
  return version; };

/**
 * css 파일에 정의되지 않은 class 를 생성하여 삽입한다
 * @param id
 * @param rule
 * @link https://stackoverflow.com/posts/10147897/revisions
 *
 * 이 펑션의 존재 이유는 특정 DOM 의 사이즈나 색깔을 그룹 단위로 조절할 때의 퍼포먼스를 확보하기 위함이다
 * 모든 셀과 컬럼의 위치를 for 루프를 통해 조정하면 속도가 느려질 수 밖에 없다
 * 그러나 이 펑션에서 사용한 css injection 기법을 사용하면
 * web browser 의 native code 구동을 유도하기에 속도가 for 루프보다 훨씬 빠르다
 * 특히 대상 객체가 많을수록 차이가 더 커진다
 *
 * css injection 에 대해서는 같은 고민을 한 사람이 여럿 있는 것 같은데, 다음 링크는 확인해보지 못했지만 살펴볼 가치가 있을듯
 * https://github.com/kajic/jquery-injectCSS
 */
function _insert_new_styles(_this, id, rule) {
  $('#' + id).remove();
  $("<div>", { id: id, html: '<style>' + rule + '</style>' })
    .appendTo(['#', _this.get_id()].join(''));
  return _this; 
}


// configure ---------------------------------------------------
/*
 * ※ monospace 지원 폰트로 볼 때 잘 보입니다.
 *
 * ┌────────┤ main div : user defined div┣─────┐  main div 는 html, jsp 에서 사용자가 정의한 div 를 사용한다
 * │   table : _fg_main_tbl                     │
 * │                                            │  _fg_div_left  는 top_corner 와 row_label  을 포함한다
 * │  _fg_div_left  _fg_div_right               │  _fg_div_right 는 col_label  과 data_table 을 포함한다
 * │ ┌────────────┬────────────┬───┐            │  top_empty, bot_empty, bot_corner 는 사용하지 않는 div
 * │ │ top_corner │ col_label  │   │ top_empty  │
 * │ │ _fg_div_00 │ _fg_div_01 │   │ _fg_div_02 │  corner, col_label, top_empty 등은 사용 편의를 위한 alias 이며
 * │ ├────────────┼────────────┼───┤            │  _fg 로 시작하는 이름들은 html element 의 id 이다
 * │ │ calc_left  │ calc_right │   │ calc_empty │
 * │ │ _fg_div10  │ _fg_div11  │   │ _fg_div_12 │
 * │ ├────────────┼────────────┼───┤            │  _fg 로 시작하는 이름들은 html element 의 id 이다
 * │ │            │            │ ^ │            │
 * │ │ row_label  │ data_table │ │ │ scroll_v   │
 * │ │ _fg_div_20 │ _fg_div_21 │ │ │ _fg_div_22 │
 * │ │            │            │ v │            │
 * │ ├────────────┼────────────┼───┤            │
 * │ │            │<---------> │   │            │
 * │ │ bot_empty  │ scroll_h   │   │ bot_corner │
 * │ │ _fg_div_30 │ _fg_div_31 │   │ _fg_div_32 │
 * │ ├────────────┴────────────┴───┤            │
 * │ │ bot_paging                  │            │
 * │ │ _fg_div_40                  │            │
 * │ └─────────────────────────────┘            │
 * └────────────────────────────────────────────┘
*/

// 기본 설정
const _default_config = {
  wheel_move_row : 1 ,  // 마우스 휠 한 번으로 스크롤할 row 의 수
  drill_down     : false,
  rows_show      : 20,  // 한 페이지에 보여줄 row 의 수 (테이블 전체 height 자동 조정)
  row_height     : 25,  // 한 row 의 height
  checkbox_size  : 20,  // checkbox 와 radio 버튼의 사이즈
  resize_icon_size     : 16,
  scroll_delay_ms      : 30,
  flexible_right_width : true,
  use_filter_div       : false,
  use_filter_panel     : false,
  use_sort_panel       : false,
  search_by_reg_exp    : false,
  search_replace       : false,
};

// datepicker 기본 설정
const _default_date_config = {
  dateFormat  : 'yy-mm-dd',
  changeYear  : true,
  changeMonth : true,
  weekHeader  : 'Wk',
  yearRange   : 'c-20:c+20',
  dayNamesMin :     ['일', '월', '화', '수', '목', '금', '토'],
  monthNames  :     ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort : ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  constrainInput     : true, // true: 숫자만 입력 가능, false: 다른 키도 입력 가능
  showMonthAfterYear : true,
};

// scheme type 별 디폴트 값 정의. 설정하지 않은 값들은 아래의 값으로 초기화된다.
const _default_scheme = {
  str       : {name:'', label:'', width: 100, h_align:'center', align:'left',   valign:'middle', edit: true, size: 2000},
  number    : {name:'', label:'', width: 100, h_align:'center', align:'right',  valign:'middle', edit: true, format: '#.############'},
  check     : {name:'', label:'', width: 30,  h_align:'center', align:'center', valign:'middle', edit: true},
  select    : {name:'', label:'', width: 100, h_align:'center', align:'center', valign:'middle', edit: true, option: []},
  gen       : 'check',  // check 와 같은 초기값을 갖는다.
  gen_label : 'check',
  radio     : 'check',
  date      : 'str'
};

// css class 스타일 이름 정의
const _style = {
  main_div : '_fg_main_div',
  row      : '_fg_row',
  cell     : '_fg_cell',
  label    : '_fg_label_text',
  input    : '_fg_input_text',
  check    : '_fg_input_check',
  select   : '_fg_input_select',
  img      : '_fg_input_img',
  calc     : '_fg_calc',
  idiv     : '_fg_input_div',
  scroll_h : '_fg_scroll_h',
  scroll_v : '_fg_scroll_v',
  readonly : '#F5EAB9',  // 읽기 전용 셀의 배경색

  row_color_odd  : '#FFFFFF' ,
  row_color_even : '#E8EEF5',
  row_selected   : '#E8EEF5',
  row_bot_line   : '1px solid #B6B6B6',
  input_padding  : 5,

  paging_button          : '_fg_paging_button',
  paging_button_selected : '_fg_paging_button_selected',

  sort_btn   : '_fg_sort_btn',
  search_div : '_fg_div_search',

  filter_btn          : '_fg_filter_icon',
  filter_btn_red      : '_fg_filter_icon_red',
  filter_div          : '_fg_div_filter',
  filter_cond         : '_fg_filter_cond',
  filter_inner_btn    : '_fg_filter_inner_btn',
  filter_sort_div     : '_fg_filter_sort_div',
  filter_search_div   : '_fg_filter_search_div',
  filter_sort_title   : '_fg_filter_sort_title',
  filter_search_title : '_fg_filter_search_title',
  filter_filter_title : '_fg_filter_filter_title',
  filter_check        : '_fg_filter_checkbox',
  filter_input        : '_fg_filter_input',
  filter_plus_btn     : '_fg_filter_plus_btn',
  filter_minus_btn    : '_fg_filter_minus_btn',

  drill_btn       : '_fg_drill_btn',
  drill_indent    : 13,
  drill_btn_width : 20,  // drill down 사용시의 label 인덴트와 버튼 사이즈(border, margin 포함)
  sort_btn_width  : 15,

  modal_div     : '_fg_div_modal',
  modal_content : '_fg_modal_content'
};

// message 설정
const _msg = {
  header_resize : '마우스로 드래그하여 너비를 조정할 수 있습니다',
  filter_run    : '적용',
  filter_close  : '닫기',
  filter_clear  : '조건 초기화',
  sort_asc      : '오름차순으로 정렬',
  sort_desc     : '내림차순으로 정렬',
  reg_exp       : 'Regular Expression',
  ig_case       : '대소문자 무시',
  find_btn      : '찾기',
  replace_btn   : '바꾸기',
  close_btn     : '닫기',
  whole_word    : '일치하는 단어만 찾기',
  wild_card     : '와일드카드(?, *) 사용',
  search_fail   : '검색 결과가 없습니다.',
  search        : '검색',
  direction     : '방향',
  option        : '옵션',
  target        : '대상',
  do_search     : '찾기',
  forward       : '정방향',
  reward        : '역방향',
  confirm       : '확인',
  filter_none   : '선택',
  filter_eq     : '= 일치',
  filter_ne     : '&ne; 불일치',
  filter_lt     : '< 작다',
  filter_gt     : '> 크다',
  filter_le     : '≤ 작거나 같다',
  filter_ge     : '≥ 크거나 같다',
  filter_begin  : '^= 시작 문자',
  filter_end    : '$= 끝 문자',
  filter_cont   : '*= 포함 문자',
  filter_ncont  : '*&ne; 제외 문자'
};

/**
 * Encoding 과 관계없이 표현가능한
 * Unicode HTML Entity (decimal) 집합
 */
FGR.prototype.sp_char = {
// 주요 그리스 문자
  g_gamma   : '&#915;',  // Γ  &Gamma;
  g_delta   : '&#916;',  // Δ  &Delta;
  g_lambda  : '&#923;',  // Λ  &Lambda;
  g_pi      : '&#928;',  // Π  &Pi;      - product 연산자, 중복순열
  g_sigma   : '&#931;',  // Σ  &Sigma;   - 순열의 합
  g_phi     : '&#934;',  // Φ  &Phi;     - 정규 분포
  g_gamma_l : '&#947;',  // γ  &gamma;
  g_delta_l : '&#948;',  // δ  &delta;
  g_lambda_l: '&#955;',  // λ  &lambda;  - 람다(선형대수학), 함수 표현식
  g_pi_l    : '&#960;',  // π  &pi;      - 원주율
  g_sigma_l : '&#963;',  // σ  &sigma;   - 표준편차, 약수함수
  g_phi_l   : '&#966;',  // φ  &phi;     - 원의 지름, 함수

// 수학, 논리학
  m_lt     : '&#60;'  ,  // <  &lt;
  m_gt     : '&#62;'  ,  // >  &gt;
  m_not    : '&#172;' ,  // ¬  &not;     - not (논리학)
  m_plusmn : '&#177;' ,  // ±  &plusmn;
  m_times  : '&#215;' ,  // ×  &times;
  m_divide : '&#247;' ,  // ÷  &divide;
  m_forall : '&#8704;',  // ∀  &forall;  - 모든(수학/논리학)
  m_exist  : '&#8707;',  // ∃  &exist;   - 존재(수학/논리학)
  m_radic  : '&#8730;',  // √  &radic;   - square root. 제곱근(수학)
  m_infin  : '&#8734;',  // ∞  &infin;   - 무한대
  m_int    : '&#8747;',  // ∫  &int;     - 인테그랄. 유니코드와 LaTeX 의 표기가 다르니 주의
  m_ne     : '&#8800;',  // ≠  &ne;
  m_le     : '&#8804;',  // ≤  &le;
  m_ge     : '&#8805;',  // ≥  &ge;
  m_less_oeq: '&#8806;',  // ≦  named entity 가 아님
  m_grt_oeq : '&#8807;',  // ≧  named entity 가 아님

// 단위 : 통화에 대해서는 다음 페이지를 참고할 것 http://www.xe.com/symbols.php
  u_per_mil    : '&#8240;' ,  // ‰  &permil;  - 천분율
  u_euro       : '&#8364;' ,  // €  &euro;    - 유로 : 영국, 스위스를 제외한 유럽
  u_celsius    : '&#8451;' ,  // ℃  no named  - 섭씨
  u_fahrenheit : '&#8457;' ,  // ℉  no named  - 화씨
  u_yuan       : '&#20803;',  // 元  no named  - 중국, ￥ 을 쓰는 경우도 있다
  u_cent       : '&#65504;',  // ￠  no named  - 미국
  u_pound      : '&#65505;',  // ￡  no named  - 영국
  u_yen        : '&#65509;',  // ￥  no named  - 일본
  u_won        : '&#65510;',  // ￦  no named  - 한국

// 공백
  c_nbsp : '&#160;'  // space &nbsp;  - 공백
};

/**
 * config 를 초기화하고, 값이 주어지지 않은 항목을 default 값으로 채운다.
 * @param cfg
 * @returns {object}
 */
function _config_initialize(cfg) {

  const col_length = this.scheme.length;

  // 0. 사용자가 정의하지 않은 기본 값을 입력한다.
  const ncfg = _insert_undefined_values(cfg, _default_config);

  // 1. fixed_header, cols_show 값을 계산한다.
  if(ncfg.cols_show === undefined){
    ncfg.fixed_header = (col_length > 1) ? 1 : 0;
    ncfg.cols_show    = (col_length > 1) ? col_length - ncfg.fixed_header : col_length;
  }

  // 2. drill_color 를 설정한다
  /*
    drill_color 는 gen 넘버에 따라 row 가 갖게되는 배경색.
    http://www.perbang.dk/rgbgradient/ 에서 제공하는 gradation color 생성기를 통해 생성한 컬러 스키마를 이용해 작성하였음.
    만약 인쇄시에도 가독성 있는 배경색을 사용할 필요가 있다면 다음 주소를 참고할 만함.
    --> http://colorbrewer2.org/ - 미국 지질연구소 지도 디자인 담당 교수가 만든 (흑백/컬러) 인쇄를 위한 지도 색깔 그라데이션 생성 서비스.
  */
  if(ncfg.drill_down && ncfg.drill_color === undefined)
    ncfg.drill_color = [ '#FFFFFF', '#FBF0F3', '#F7E3EB', '#F3D5E7', '#EFC8E8', '#EABBEB', '#DBAFE7', '#CBA3E3', '#B297DF', '#998CDC' ];

  // 3. date 설정
  ncfg.date = (ncfg.date) ? _insert_undefined_values(ncfg.date, _default_date_config)
    : _default_date_config;

  return ncfg; 
};

/**
 * scheme type 별 default 설정을 추가(사용자가 정의한 scheme 의 빈 값을 default 값으로 채운다) 하고, 초기 설정을 계산한다
 * @param _this
 * @param scheme
 * @returns {object}
 */
function _scheme_initialize(scheme){

  this.get_cell_define = _make_const_getter(_create_cell_define(this));  // cell 의 type 에 따른 특징과 기능을 보관한다

  const _this = this;
  const date_cfg = (this.cfg.date) ? _insert_undefined_values(this.cfg.date, _default_date_config)
      : _default_date_config;

  // 사용자가 정의하지 않은 컬럼 기본 설정을 복사한다.
  function _get_column (col) {
    if(! col.type) throw new Error('need column type.');
    const def  = _default_scheme[col.type];
    const defn = (_.isString(def)) ? _default_scheme[def] : def;
    return _insert_undefined_values(col, defn);
  }
  
  scheme.forEach(function(col){
    
    const column = _get_column(col);

    // 컬럼 초기 width 를 설정한다
    column.init_width = column.width;  

    // edit false 라면 읽기 전용 배경색을 지정해 준다
    if(!column.bg_color && column.edit === false)
      column.bg_color = _style.readonly;

    // cell 타입별 정의를 참조한다.
    const set = this.get_cell_define()[column.type];  
    
    column.element = set.element;

    // 사용자가 설정한 getter 우선
    column.getter  = column.getter || set.getter;  

    column.init_data = (column.init_data === undefined) ? set.init_data : column.init_data;
    column.width_adj = set.width_adj;
    
    column.focus_in = column.focus_in || set.focus_in;

    if(column.type === 'date'){
      column.date = (column.date) ? _insert_undefined_values(column.date, date_cfg) : date_cfg;
    }

    if(! column.format_regexp && column.size && _.isNumber(column.size)){
      column.format_regexp = new RegExp(`(^.{0, ${_toInt(column.size)} }).*$`);
    } else if(column.format){
      const point_length = column.format.replace(/^(#+\.)/, '').length;
      column.format_regexp = new RegExp(`(^[^\\.]+(?:\\.\\d{1,${point_length}})?).*$`);
    }
    
    if(column.format_regexp){
      column.input_slicer  = ((format) => {
        return (v) => String(v).replace(format, '$1'); 
      })(column.format_regexp);
    }

    // output functions
    column.setter           = column.setter           || set.setter;
    column.output_validator = column.output_validator || set.output_validator;
    column.output_formatter = column.output_formatter || set.output_formatter;
    column.output_css       = column.output_css       || set.output_css;
    column.init_data        = column.init_data        || set.init_data;

    /*
     * data 를 화면에 보여주는 setter function wrapping 작업
     * combined setter : validator + output_css + formatter + setter
     */
    column.setter = (function(column, set){
      //setter($cell, value, row, col, this);
      const out_css   = column.output_css;
      const validator = column.output_validator;
      const formatter = column.output_formatter;
      const init_data = column.init_data;
      const setter    = column.setter;
      const setter2   = (formatter) ? function($cell, v, row, col, _this){ return setter($cell, formatter(v), row, col, _this); } : setter;
      const setter3   = (out_css)   ? function($cell, v, row, col, _this){ return setter2($cell.css(out_css(v)), v, row, col, _this); } : setter2;
      const setter4   = (validator) ? function($cell, v, row, col, _this){ return setter3($cell, validator(v) ? v : init_data, row, col, _this); } : setter3; 
      return setter4;
    })(column, set);

    // input functions
    column.getter          = column.getter          || set.getter;
    column.input_validator = column.input_validator || set.input_validator;
    column.input_formatter = column.input_formatter || set.input_formatter;
    column.input_caster    = column.input_caster    || set.input_caster;

    column.data_push = (function data_push(){

      const getter    = column.getter;
      const validator = column.input_validator;
      const formatter = column.input_formatter || (v => v);
      const slicer    = column.input_slicer    || (v => v);
      const caster    = column.input_caster    || (v => v);
      const out_css   = column.output_css;
      const after_input = column.after_input;
      
      function get_result (v_string, validator, loc) {
        if(! validator)
          return v_string;
        else if(validator(v_string))
          return caster( slicer(v_string));
        else
          return _this.data[loc.row][loc.col];
      }
    
      return function($cell, loc, value){

        const result = get_result(formatter(value), validator, loc);

        if($cell && out_css) $cell.css(out_css(result));
        
        if(after_input) after_input($cell, loc, result);

        return result;
      };
    })(); // end of data_push

    return column;
  }, this);

  return scheme;
};

/** 사용자 정의 데이터 타입 */
FGR.prototype.custom_cell_define = {};

/**
 * 이벤트 핸들러 펑션
 */
FGR.prototype.event_handler = { };

/** change_val : 값을 편집할 수 있게 하는 최중요 펑션 */
FGR.prototype.event_handler.change_val = function(e, evt_process) {

  const loc      = this.get_loc(e.target);
  const before   = this.data[loc.row][loc.col];
  const editable = this.is_editable_cell(loc.row, loc.col);
  const cell     = this.event_handler.cell = { editable, loc, };

  if (editable) {
    const $cell = $(e.target);
    const column = this.scheme[loc.col];
    this.data[loc.row][loc.col] = column.data_push($cell, loc, column.getter($cell));
  } else {
    return this.refresh();
  }

  const after = this.data[loc.row][loc.col];

  if(before !== after && evt_process === undefined){
    this.data[loc.row].modified = true;
    _change_event_processor(e, this, before, after);
  }
};

/** focus_in 이벤트 핸들러 */
FGR.prototype.event_handler.focus_in = function(e) {

  const $target  = $(e.target);
  const loc      = this.get_loc(e.target);
  const temp_cell= this.event_handler.cell;
  const editable = this.is_editable_cell(loc.row, loc.col);

  // 중복 focus in 을 방지한다
  if(temp_cell && temp_cell.loc.row === loc.row && temp_cell.loc.col === loc.col)
    return;

  this.event_handler.cell = { loc, editable, };

  this.div.filter.hide();

  // 직전에 선택된 cell 의 disabled 속성을 풀어준다
  if(this.pre_cell) this.pre_cell.removeAttr('disabled');

  // 선택된 컬럼을 기록해 둔다
  this.col_selected = loc.col;

  // 편집 금지된 셀이라면 추후 발생할 이벤트를 방지한다
  if(!editable) e.preventDefault();

  const focus_in_after = this.scheme[loc.col].focus_in;

  if(focus_in_after) focus_in_after.bind(this)(e, $target, loc);

  // 편집 금지된 셀이라면 disabled 속성을 입력한다.
  $target.attr('disabled', ! editable);

  // 선택된 셀 객체를 보관한다.
  this.pre_cell = $target;

  if(editable) _focusin_event_processor(e, this);
  
  return e;
};

/** focus_out 이벤트 핸들러 */
FGR.prototype.event_handler.focus_out = function(e) {
  //change_val(e, false);
  // focus out 이벤트가 발생한 경우 사용자 정의 focusout 이벤트를 실행시킨다
  if(this.event_handler.cell.editable)
    _focusout_event_processor(e, this);
};

FGR.prototype.event_handler.focus_number = function(e) {
  // number 타입의 cell 에 focus 가 들어간 경우, 콤마 형식의 숫자가 아니라 원본 숫자 데이터를 보여준다.
  //focus_in(e);
  const $cell = this.event_handler.cell;
  
  if($cell.editable){
    const loc   = $cell.loc;
    const value = this.data[loc.row][loc.col]; // 편집 가능한 셀이라면 콤마를 제거한 원본 숫자를 보여준다
    this.event_handler.temp_number = value;
    $(e.target).val(value); 
  }
};

FGR.prototype.event_handler.focus_out_number = function (e){
  // number 타입의 cell 에서 focus 가 해제되면, 콤마 형식의 숫자로 변환하여 보여준다.
  const loc    = this.get_loc(e.target);
  const v      = this.data[loc.row][loc.col];
  const $this  = $(e.target);
  const is_null= (_.isNull(v) || /^\s*$/.test(v));

  if(is_null)
    $this.val(null);
  else
    $this.val(_to_comma_format(v));

  if(this.scheme[loc.col].calc_row && this.event_handler.temp_number !== v)
    this.refresh_calc_cell(loc.col);

  if(this.event_handler.cell.editable)
    _focusout_event_processor(e, this);
};

/**
 * 데이터 셀의 종류와 속성을 정의한다.
 *
 * element   : 사용할 html tag
 * type      : input tag 일 경우의 type
 * event     : 해당 element 에 부여할 이벤트 펑션 목록
 * data_push : 화면 상의 데이터를 this.data 에 입력할 때의 전처리 펑션 (예: 숫자 형식의 문자열에서 콤마를 제거하는 등)
 * setter    : Cell setter
 * getter    : Cell getter
 */
function _create_cell_define(_this){
  
  function _set_interceptor_2_(target, interceptor, secondArg){ 
    return function(e){ interceptor(e, secondArg); target(e); }; 
  }

  //setter($cell, value, row, col, this);
  const cell_def     = {};
  const std_setter   = ($cell,v) => $cell.val(v);
  const std_getter   = ($cell  ) => $cell.val( );
  const text_setter  = ($cell,v) => $cell.text(v);
  const text_getter  = ($cell  ) => $cell.text( );
  const check_setter = ($cell,v) => $cell.prop('checked', _.isNumber(v) && v > 0);
  const check_getter = ($cell  ) => { return $cell.prop('checked') ? 1 : 0; };
  const key_down     = function(e) { _move_focus(e, _this); };      // key_down 시 cursor focused 를 이동한다.
  const change_val   = _this.event_handler.change_val.bind(_this);  // 값을 편집할 수 있게 하는 최중요 펑션
  const focus_in     = _this.event_handler.focus_in.bind(_this);
  const focus_out_num= _this.event_handler.focus_out_number.bind(_this);

  const tmp_focus_out= _this.event_handler.focus_out.bind(_this);
  const tmp_focus_num= _this.event_handler.focus_number.bind(_this);

  const focus_out = _set_interceptor_2_(tmp_focus_out, change_val, false);  // focus_out 실행전에는 change_val 이 먼저 실행된다
  const focus_num = _set_interceptor_2_(tmp_focus_num, focus_in, undefined);  // focus_num 실행전에는 focus_in 이 먼저 실행된다
  
  /*
   * data_push 는 화면 상의 문자열을 가공하여 data 배열에 입력할 값으로 변경해주는 함수이다.
   * 화면 상 셀의 값은 모두 문자이기 때문에 이 변경은 숫자 형식인 경우 특히 중요하다.
   * 
   * input_formatter : 화면상의 cell 에 담긴 String 을 데이터화하기 좋은 String 으로 재가공한다.
   * input_validator : 화면상의 cell 에 담긴 String 이 형식에 맞는지 검사한다.
   * input_slicer    : formatter 가 리턴한 문자열을 지정된 길이로 자른다.
   * input_caster    : formatter 가 리턴한 문자열을 해당 타입으로 캐스팅한다. (예: 문자열을 숫자 타입으로 변환)
   * output_css      : 값을 입력함과 동시에 cell 의 css 를 변경해준다.
   */

  // data types *********************************
  cell_def.str = {
    element   : 'input',
    type      : 'text',
    style     : _style.input,
    width_adj : -11,
    //output_css      : undefined,
    //output_validator: _.isString,
    //output_formatter: undefined,
    getter    : std_getter,
    setter    : std_setter,
    init_data : null,
    //input_validator: _.isString,
    //input_formatter: undefined,
    //input_caster   : String,
    event : {
      focusin : focus_in,
      focusout: focus_out,
      keydown : key_down,
      keyup   : change_val,
    },
  };

  cell_def.str_label = {  // 헤더에서 사용하는 셀 타입
    element   : 'input',
    type      : 'text',
    style     : _style.input,
    width_adj : -11,
    //output_css      : undefined,
    //output_validator: _.isString,
    //output_formatter: undefined,
    getter    : std_getter,
    setter    : std_setter,
    init_data : null,
    //input_validator: _.isString,
    //input_formatter: undefined,
    //input_caster   : String,
    event : {
      keydown : key_down,
      keyup   : change_val,
      focusin : focus_in,
      focusout: focus_out,
    },
  };

  cell_def.number = {
    element   : 'input',
    type      : 'text',
    style     : _style.input,
    width_adj : -11,
    output_css      : (v) => { return { color: (v < 0) ? 'red' : 'black' }; }, // return css style by number
    output_validator: _.isNumber,
    output_formatter: _to_comma_format, // return number comma format applied
    getter    : std_getter,
    setter    : std_setter,
    init_data : null,
    input_validator: _is_number_str,
    input_formatter: (v) => v.replace(/,/g, ''),
    input_caster   : Number,
    event : {
      keydown : key_down,
      keyup   : change_val,
      focusin : focus_num,
      focusout: focus_out_num,
    },
  };

  cell_def.check = {
    element   : 'input',
    type      : 'checkbox',
    style     : _style.check,
    width_adj : 0,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    getter    : check_getter,
    setter    : check_setter,
    init_data : 0,
    input_validator: _.isNumber,
    //input_formatter: undefined,
    //input_caster   : undefined,
    event : { change : change_val, },
  };

  cell_def.radio = {
    element   : 'input',
    type      : 'radio',
    style     : _style.check,
    width_adj : 0,
    //output_css      : undefined,
    //output_validator: _.isNumber,
    //output_formatter: undefined,
    getter    : check_getter,
    setter    : check_setter,
    init_data : 0,
    //input_validator: _.isString,
    //input_formatter: undefined,
    //input_caster   : String,
    after_input: function($cell, loc, value){
      // 필터링 된 상태에서 라디오 버튼을클릭한다면, pre_filter_data 의 라디오 버튼 값을 청소해 주어야 한다
      // 필터를 풀었을 때, 라디오 버튼 값이 1 개를 초과할 일을 방지하기 위함.
      const data = (_this.pre_filter_data) ? _this.pre_filter_data : _this.data;
      data.forEach(function(v){ v[loc.col] = 0; });
    },
    event : {
      focusin : focus_in,
      change  : change_val,
    },
  };

  cell_def.select = {
    element   : 'select',
    style     : _style.select,
    width_adj : 0,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    child     : 'option',  // child 는 select 의 하위에 들어갈 element name 이며,
    scheme    : 'option',  // scheme 은 사용자 설정에서 참고할 key 값이다.
    getter    : std_getter,
    setter    : std_setter,
    init_data : null,
    //input_validator: undefined,
    //input_formatter: undefined,
    //input_caster   : undefined,
    event : {
      focusin : focus_in,
      change  : change_val,
    },
  };

  cell_def.date = {
    element   : 'input',
    type      : 'text',
    style     : _style.input,
    width_adj : -11,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    getter    : std_getter,
    setter    : std_setter,
    init_data : null,
    //input_validator: undefined,
    //input_formatter: undefined,
    //input_caster   : undefined,
    event : {
      focusin : focus_in,
      focusout: focus_out,
      keydown : key_down,
      change  : change_val,
      keyup   : change_val },
    focus_in : function(e, $cell, loc){ 
      // date 타입의 셀이라면 editable 속성을 따져 datepicker 를 생성하거나 제거한다
      const editable = this.is_editable_cell(loc.row, loc.col);
      $cell.datepicker(editable ? this.scheme[loc.col].date : 'destroy');
    },
  };

  cell_def.gen = {
    element   : 'div',
    type      : 'text',
    style     : _style.input,
    width_adj : -11,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    getter    : text_getter,
    setter    : text_setter,
    //input_validator: undefined,
    //input_formatter: undefined,
    //input_caster   : undefined,
    init_data : '',
  };

  cell_def.gen_label = {
    element   : 'div',
    type      : 'text',
    style     : _style.input,
    width_adj : 0,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    getter    : text_getter,
    setter    : text_setter,
    //input_validator: undefined,
    //input_formatter: undefined,
    //input_caster   : undefined,
    init_data : '',
  };

  cell_def.img = {
    element   : 'div',
    type      : '',
    style     : _style.img,
    width_adj : 0,
    //output_css      : undefined,
    //output_validator: undefined,
    //output_formatter: undefined,
    rule      : (v) => '',
    getter    : text_getter,
    setter    : function($cell, v, row, col){ 
      const image = _this.scheme[col].rule(v);
      $cell.text((v === null) ? '' : v);
      $cell.css('background-image', image);
    },
    //input_validator: undefined,
    //input_formatter: undefined,
    //input_caster   : undefined,
    init_data : null,
  };

  cell_def.free = {
    element   : 'div',
    type      : '',
    style     : _style.input,
    width_adj : 0,
    init_data : null,
    event : {
      focusin : focus_in,
      focusout: focus_out,
      keydown : key_down,
      change  : change_val,
      keyup   : change_val,
    }
  };

  for(var key in _this.custom_cell_define){
    cell_def[key] = _this.custom_cell_define[key];
    if(cell_def[key].event === 'default'){
      cell_def[key].event = {
        focusin : focus_in,
        focusout: focus_out,
        keydown : key_down,
        change  : change_val,
        keyup   : change_val }
    }
  }
  return cell_def; 
};

/**
 * 개별 데이터에 size(str) / format(number) 옵션을 적용한다
 * @param data
 * @param col
 * @returns
 */
FGR.prototype.apply_data_size = function(data, col){
  const format = this.scheme[col].format_regexp;

  if(format)
    return String(data).replace(format, '$1');
  else 
    return data; 
};

/**
 * Constructor
 * @param id    : (string) Grid 를 삽입할 div element 의 id
 * @param cfg   : (object) Grid 설정
 * @param scheme: (array)  컬럼 설정
 * @returns {FGR}
 */
function FGR(id, cfg, scheme) {
  
  this.cfg  = cfg;

  const _this           = this;

  // getter methods
  this.get_id              = _make_const_getter(id);
  this.get_original_cfg    = _make_const_getter($.extend(true, {}, cfg));
  this.get_original_scheme = _make_const_getter(scheme.map(_.clone));
  this.get_gen_col         = _make_const_getter(_.findIndex(scheme, { 'type': 'gen' }));        // gen 넘버 컬럼 인덱스
  this.get_gen_label_col   = _make_const_getter(_.findIndex(scheme, { 'type': 'gen_label' }));  // gen_label 넘버 컬럼 인덱스
  this.get_IE_version      = _make_const_getter(_check_ie_version());
  this.is_IE               = _make_const_getter(_check_ie_version() > 0);
  this.is_IE               = _make_const_getter(this.get_IE_version() > 0);

  this.page_index  = 1;     // 현재 페이지 인덱스 (paging 설정시 사용)
  this.cell        = [];    // cell 객체를 보관할 배열 선언 (논리상의 cell 이 아니라 화면 상의 cell)
  this.rows        = [];    // rows 객체를 보관할 배열 선언 (논리상의 row  가 아니라 화면 상의 row : div element)

  // drill down 기능을 위한 변수들
  this.hidden_row_cnt = 0;   // drill down 기능 사용시 scroll bar 의 길이 조절용 자료로 사용된다
  this.drill_btn      = [];  // drill button  객체를 보관할 배열 선언 (화면 상의 button)
  this.gen_label      = [];  // gen_label div 객체를 보관할 배열 선언 (화면 상의 div)
  this.drill_cell     = [];

  // 화면에 데이터를 보여주는 펑션 : 빠른 처리 속도를 위해 일반적인 경우와 drill down 기능이 있는 경우 각기 다른 펑션을 이용한다
  this.render_data = (this.cfg.drill_down) ? _show_drill_data : _show_data;

  // cell 관련
  this.scheme        = _scheme_initialize.call(this, scheme);  // column scheme 을 초기화한다
  this.header_labels = _get_header_labels_array.call(this);    // header 컬럼 레이블의 문자열 배열
  this.header_cells  = this.header_labels.map((v) => []);      // header 컬럼 레이블이 입력될 cell 의 배열 (merge 작업 대비)

  this.cfg = _config_initialize.call(this, cfg);  // config 를 초기화한다

  // 사이즈, div, table 셋팅
  this.cfg = _size_setting.call(this);
  this.div = _div_setting.call(this);
  this.tbl = _tbl_setting.call(this);

  _set_cell_left_array.call(this);  // 각 컬럼별 x 좌표 계산
  _create_col_style(this, 0);       // 각 컬럼별 css 스타일 생성 (0 번 컬럼부터 시작)

  // sort / filter 관련
  this.cfg.sort      = _.findIndex(this.scheme, { sort: true }) >= 0;
  this.sorted_column = -1;
  this.filtered      = false;
  this.sorted        = false;

  // prototype row 생성 : grid 생성시 이 prototype row 를 복제하여 각 cell 과 row 를 나열하여 grid 를 만들어낸다.
  ((start, fence, end) => {

    this.proto          = {};
    this.proto.cell     = _create_proto_cell.call(this);
    this.calc_cell      = _create_proto_cell.call(this, 'input', 'calc_row');
    this.proto.row      = [];
    this.proto.row[0]   = _create_proto_row.call(this, start, fence, this.cfg.left_width);
    this.proto.row[1]   = _create_proto_row.call(this, fence, end,   this.cfg.right_width);
    this.proto.scroll_v = _create_proto_row.call(this, start, 1, 1).css('visibility', 'hidden').empty();

    const _this = this;
    const row_click_event = function (e){
      try{ _click_event_processor(e, _this); } catch (event){}  // 사용자가 정의한 이벤트를 실행한다 

      const $this = $(this);
      const row   = _toInt($this.attr('row'));  // 화면 상의 row

      _this.row_selected = _toInt($this.find('[row]').first().attr('row'));  // data 상의 row

      // 현재 색칠된 상태인 row 의 색을 본래대로 되돌린다
      if(_this.highlight_row >= 0)
        _this.paint_one_row(_this.highlight_row, _this.before_highlight_color);

      _this.highlight_row = row;

      if(_this.get_gen_col() < 0){
        _this.before_highlight_color = $this.css('background-color');
        _this.paint_one_row(row, _style.row_selected);
      } else {
        _this.render_data(_this, _this.current_top_line);
      }
      return;
    };

    this.proto.row.forEach(function(v){ v.mousedown(row_click_event); });  // row click 이벤트 부여

  })(0, this.cfg.fixed_header, this.scheme.length);


  this.current_top_line       =  0;  // 화면상의 최상단 row 의 this.data 인덱스
  this.highlight_row          = -1;  // row 하이라이트 바의 위치 (-1 이면 선택한 row 없음)
  this.row_selected           = -1;
  this.col_selected           = false;
  this.highlight_refresh      = true;
  this.before_highlight_color = '';  // pre selected row 의 color

  this.buttons = _create_buttons(this);  // 버튼 생성 (드릴 다운, 페이징 등등의 용도)
  this.resize_btn = {};

  this.scroll_mode    = false;

  // 수직 스크롤 바 생성
  this.scroll_v_inner = $('<div>', {id : `${id}_scroll_v_inner`})
    .width(1).height(0)
    .css('visibility', 'hidden');

  return this;
}

/**
 * 설정을 참고하여 Grid 를 조립한다.
 * @returns {FGR}
 */
FGR.prototype.Create_grid = function Create_grid() {

  const _this = this;
  const start = 0;
  const fence = this.cfg.fixed_header;
  const end   = this.scheme.length;

  function scroll_h_func (e) { 
    _this.div.right.scrollLeft($(this).scrollLeft());
  };

  function scroll_v_func (e) {
    if( ! _this.scroll_mode) return;

    const v_location = Math.ceil($(this).scrollTop());     // 현재 스크롤의 위치 (y 좌표)
    const remainder  = v_location % _this.cfg.wheel_move;  // y 좌표를 wheel 단위로 나눈 나머지 (불연속 스크롤 기능 구현)
    const row_cnt    = (v_location - remainder) / _this.cfg.row_height;

    _this.current_top_line = row_cnt;
    _this.render_data(_this, row_cnt);
  } // end of scroll_v_func

  // 1. 조립 전에 부품들을 생성해 둔다
  _div_size_adjust.call(this);                 // div 사이즈를 조정한다
  _create_header.call(this, 0, start, fence);  // 좌측 헤더를 완성한다
  _create_header.call(this, 1, fence, end);    // 우측 헤더를 완성한다
  _create_merge_v_header.call(this);           // 상단 레이블 텍스트를 merge 한다.
  _create_merge_h_header.call(this);           // 상단 레이블 텍스트를 수직 merge 한다
  _create_adjust_header_cell_v_loc(this);      // 헤더 셀 내부 수직 정렬
  _create_calc_row.call(this);     // 계산행을 생성한다
  _create_resizer.call(this);      // resizer 를 부착한다
  _create_filter_icon.call(this);  // filter icon 을 부착한다
  _create_search_div.call(this);   // 검색 modal 을 생성한다
  _create_modal_div.call(this);    // 상태 표시용 modal 을 생성한다

  // scroll_h 를 생성한다
  this.scroll_bar_h = $('<div>', {id: `${this.get_id()}_scroll_bar_h`})
    .addClass(_style.scroll_h)
    .width(_this.cfg.right_width)
    .height(1)
    .appendTo(_this.div.scroll_h);

  if(this.cfg.cols_show >= this.scheme.length)
    this.div.scroll_h.closest('tr').hide();  // 컬럼 수에 따라 수평 스크롤 바를 숨기거나 보여준다

  // 1. 조립 설계도
  const objs = (() => {
    const left        = this.cfg.left_width;
    const right       = this.cfg.right_width;
    const right_show  = this.cfg.right_width_show;
    const calc_height = (this.cfg.calc_row) ? this.cfg.row_height : 0;
    const data_height = this.cfg.rows_show * this.cfg.row_height;
    const scr_width   = this.cfg.scroll_bar_width;

    const blue_print = [
       { div_name: 'left',      width : left + 2       },
       { div_name: 'right',     width : right_show + 1 },
       { div_name: 'top_corner'                        },
       { div_name: 'col_label', width : right          },
       { div_name: 'calc_left', height: calc_height    },
       { div_name: 'calc_right',height: calc_height,   width : right },
       { div_name: 'row_label', height: data_height                  },
       { div_name: 'data_table',height: data_height,   width : right },
       { div_name: 'scroll_h',  height: scr_width + 1, width : right_show + 2, scroll : scroll_h_func },
       { div_name: 'scroll_v',  height: this.cfg.scroll_v_height,
         width    : scr_width + 1,
         mouseover: () => { this.scroll_mode = true;  },
         mouseout : () => { this.scroll_mode = false; },
         scroll   : scroll_v_func,
         child    : this.scroll_v_inner }
    ];

    if(this.cfg.calc_row === 'bottom'){
      blue_print.push({ div_name: 'bot_empty', height: 0 });
      blue_print.push({ div_name: 'bot_right', height: 0, width: this.cfg.right_width });
    }
    return blue_print;
  })();

  // 2. 조립 실행
  objs.forEach(function(v){
    const div = _this.div[v.div_name];
    if(v.width    ) div.width( v.width );
    if(v.height   ) div.height(v.height);
    if(v.scroll   ) div.scroll(v.scroll);
    if(v.child    ) div.append(v.child );
    if(v.mouseout ) div.mouseout( v.mouseout);
    if(v.mouseover) div.mouseover(v.mouseover);
  });

  // 3. 이벤트 바인딩
  _attatch_evt_wheel(this);  // 마우스 휠 이벤트
  _attatch_evt_check(this);  // 체크박스 이벤트(전체선택, 선택취소)
  _attatch_evt_paste(this);  // ctrl+v 붙여넣기 이벤트
  _attatch_evt_excel(this);  // excel 파일 드래그 & 드랍 이벤트
  
  this.div.main.keydown( function search_evt (e) {
    if(e.ctrlKey && e.keyCode === 70){
      _this.div.search.show().find('input:first').focus();
      e.preventDefault();
    }
  });

  this.click_event   = [];
  this.change_event  = [];
  this.focusin_event = [];
  this.focusout_event= [];
  this.event_flag = {click: true, change: true, focusin: true, focusout: true};

  // 4. 보조 데이터 구성
  this.original_data = false;
  this.deleted_data  = [];
  this.data = this.create_init_data();
  this.data.forEach(function(row, i){ row.index = i; });  // indexing

  _create_rows(this, this.data);  // null data 로딩을 통해 row 를 생성한다
  this.refresh();

  return this;
}; // end of create grid

/**
 * 셀 클릭 이벤트를 처리한다. 각 이벤트 펑션은 this.click_event 에 배열로 지정되어 있다.
 * 이벤트는 배열에 등록된 순서대로 발생하며, 발생 직전 this.event_flag 를 검사하므로
 * 이벤트 발생을 방지하기 위해서는 event_flag 의 해당 값을 false 로 변경해주면 된다.
 *
 * 개별 이벤트 펑션에 입력되는 parameter 는 다음과 같다.
 * e  : event 객체
 * row: 이벤트가 발생한 cell 의 row index
 * col: 이벤트가 발생한 cell 의 col index
 * val: 이벤트가 발생한 cell 의 값
 * _this: grid 객체
 *
 * @param e
 * @param _this
 * @returns {FGR}
 */
function _click_event_processor(e, _this){
  if(_this.event_flag.click) {
    const loc = _this.get_loc(e.target);
    _this.click_event.forEach(function(v){
      v(e, loc.row, loc.col, _this.data[loc.row][loc.col], _this);
    });
  }
  return _this;
};

/**
 * 셀의 값을 변경할 때 발생하는 이벤트를 처리한다. 각 이벤트 펑션은 this.change_event 에 배열로 지정되어 있다.
 * 
 * e : event 객체
 * row : 이벤트가 발생한 cell 의 row index
 * col : 이벤트가 발생한 cell 의 col index
 * val : 이벤트가 발생한 cell 의 값
 * before : 이벤트가 발생하기 직전 cell 의 값
 * _this :  grid 객체
 *
 * @param e
 * @param _this
 * @returns {FGR}
 */
function _change_event_processor(e, _this, before, after){
  if(_this.event_flag.change) {
    const loc = _this.get_loc(e.target);
    _this.change_event.forEach(function(v){
      v(e, loc.row, loc.col, _this.data[loc.row][loc.col], before, _this);
    });
  }
  return _this;
};

/**
 * 셀 포커스 인 이벤트를 처리한다. 각 이벤트 펑션은 this.focusin_event 에 배열로 지정되어 있다.
 *
 * e : event 객체
 * row : 이벤트가 발생한 cell 의 row index
 * col : 이벤트가 발생한 cell 의 col index
 * val : 이벤트가 발생한 cell 의 값
 * _this :  grid 객체
 *
 * @param e
 * @param _this
 * @returns {FGR}
 */
function _focusin_event_processor(e, _this){
  if(_this.event_flag.focusin) {
    const loc = _this.get_loc(e.target);
    _this.focusin_event.forEach(function(v){
      v(e, loc.row, loc.col, _this.data[loc.row][loc.col], _this);
    });
  }
  return _this;
};

/**
 * 셀 포커스 아웃 이벤트를 처리한다. this.focusout_event 에 배열로 지정되어 있다.
 *
 * e : event 객체
 * row : 이벤트가 발생한 cell 의 row index
 * col : 이벤트가 발생한 cell 의 col index
 * val : 이벤트가 발생한 cell 의 값
 * _this :  grid 객체
 *
 * @param e
 * @param _this
 * @returns {FGR}
 */
function _focusout_event_processor(e, _this){
  if(_this.event_flag.focusout) {
    const loc = _this.get_loc(e.target);
    _this.focusout_event.forEach(function(v){
      v(e, loc.row, loc.col, _this.data[loc.row][loc.col], _this);
    });
  }
  return this; 
};

/**
 * header label 의 checkbox 에 전체선택/선택취소 이벤트를 부여한다
 * @param {FGR}
 */
function _attatch_evt_check(_this){
  
  // '전체 선택 체크박스'를 클릭하면 data 의 해당 컬럼의 모든 값을 '전체 선택 체크박스'와 같은 값으로 맞춘다
  function select_all (e) {
    const $this = $(this);
    const col   = _toInt($this.attr('col'));
    const div   = (col < _this.cfg.fixed_header) ? _this.div.row_label : _this.div.data_table;
    const nm    = $this.attr('name');
    const val   = $this.prop('checked') ? 1 : 0;

    div.find(`input[name=${nm}]`)
      .prop('checked', $this.prop('checked'));

    _this.data.forEach(function(row, i){ row[col] = val; });
    _this.render_data(_this, _this.current_top_line);
    return;
  };
  
  // '전체 선택 라디오' 를 클릭하면 해당 컬럼의 모든 값을 0 으로 맞춘다
  function select_radio (e) {
    const col = _toInt($(this).attr('col'));
    _this.data.forEach(function(row){ row[col] = 0; });
    _this.render_data(_this, _this.current_top_line);
    return;
  };

  [0, 1].forEach(function (i) {
    this[i].find('input[type=checkbox]').click(select_all);
    this[i].find('input[type=radio]'   ).click(select_radio);
  }, _this.div[0]);

  return _this;
};

/**
 * row_label 과 data_table 에 마우스 휠 이벤트를 부여한다
 * @param _this
 * @returns {FGR}
 */
function _attatch_evt_wheel(_this){
  function is_up_dir (e){
    return (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0);
  };
  _this.div.main.bind('mousewheel DOMMouseScroll', function wheel_evt (e){
      _this.scroll_row(is_up_dir(e)? -1:1); 
  });
  return _this;
};

/**
 * 엑셀 파일 drag & drop 이벤트를 부여한다.
 */
function _attatch_evt_excel(_this){

  // 드래그 오버 이벤트 처리
  function handleDragover(e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  // data 교정
  function fixdata(data) {
    var o = "", l = 0, w = 10240;
    for( ; l < data.byteLength/w ; ++l ) {
      o += String.fromCharCode.apply(null,new Uint8Array(data.slice(l * w, l * w + w)));
    }
    o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w)));
    return o;
  }

  // excel sheet 데이터를 2차원 배열로 가공한다
  function sheet_to_array(sheet, scheme) {

    if(sheet == null || sheet["!ref"] == null) return [];

    const date_type_exist = _.some(scheme, (col) => ( col.type === 'date' ));
    
    // 문제 있음 : 날짜 형식 체크 과정이 병목.
    let typefy;
    if(date_type_exist) {
      typefy = function(v, col){ 
        return (col.type === 'date' && typeof v === 'number') ? $.datepicker.formatDate(col.date.dateFormat, new Date((v - 25569) * 86400000)) : v;
      }
    } else {
      typefy = function(v){ return v; };
    }

    const range     = safe_decode_range(sheet["!ref"]);
    const start_col = range.s.c;
    const end_col   = range.e.c;
    const col_range = _.range(start_col, end_col + 1);
    const cols      = col_range.map( (c) => XLSX.utils.encode_col(c) );

    let C, txt, val, col_index;
    const data = _.range(range.s.r, range.e.r + 1).map((Row) => {
      const one_row = [];
      const rr      = XLSX.utils.encode_row(Row);

      for( C = start_col; C <= end_col; ++C ) {
        val = sheet[cols[C] + rr];
        txt = (val !== undefined) ? val.v : null;

        col_index = C - start_col;
        txt = typefy(txt, scheme[col_index]);

        if(col_index < scheme.length) one_row.push(txt);
      }
      return one_row;
    });

    return data;
  } // end of sheet_to_array

  // excel worksheet 의 !ref 값을 범위로 파싱한다.
  function safe_decode_range(range) {
    var o   = {s:{c:0,r:0},e:{c:0,r:0}},
      idx = 0, i = 0, cc = 0,
      len = range.length;

    for(idx = 0; i < len; ++i) {
      if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
      idx = 26*idx + cc;
    }
    o.s.c = --idx;

    for(idx = 0; i < len; ++i) {
      if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
      idx = 10*idx + cc;
    }
    o.s.r = --idx;

    if(i === len || range.charCodeAt(++i) === 58) { o.e.c=o.s.c; o.e.r=o.s.r; return o; }

    for(idx = 0; i != len; ++i) {
      if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
      idx = 26*idx + cc;
    }
    o.e.c = --idx;

    for(idx = 0; i != len; ++i) {
      if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
      idx = 10*idx + cc;
    }
    o.e.r = --idx;
    return o; 
  } // end of safe_decode_range

  // drop 이벤트
  function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    const files = e.dataTransfer.files;
    const f     = files[0];
    const reader= new FileReader();
    const name  = f.name;

    reader.onload = function(e) {
      const data = e.target.result;
      const wb   = XLSX.read(btoa(fixdata(data)), {type: 'base64'});
      const w    = wb.Sheets[wb.SheetNames[0]];
      const res  = sheet_to_array(w, _this.scheme);
      //window.result = res;
      _this.clear();
      _this.Load_data(res);
    };
    reader.readAsArrayBuffer(f);
  }

  const drop = _this.div.main.get(0);
  if(drop.addEventListener) {
    drop.addEventListener('dragenter',handleDragover, false);
    drop.addEventListener('dragover', handleDragover, false);
    drop.addEventListener('drop',     handleDrop, false);
  }

  return _this;
}

/**
 * 데이터 row view 생성
 * @param data
 * @param callback
 * @returns {FGR}
 */
function _create_rows(_this, data, callback){

  // 프로토타입 row 를 복제한다
  const temp_row = [
    _this.proto.row[0].clone(true, true),
    _this.proto.row[1].clone(true, true)
  ];
  
  const inputs = _this.scheme.map((column, i) => {
    const div = (i < _this.cfg.fixed_header) ? 0 : 1;
    return temp_row[div].find(`${column.element}[col=${i}]`);
  });

  append_row(0, _this.cfg.rows_show, _this.scheme.length, temp_row, inputs, _this);
  
  _this.div.row_label.append(_this.div.under_line_left);
  _this.div.data_table.append(_this.div.under_line_right);

  // 수직 스크롤 바의 길이를 조절한다.
  _this.hidden_row_cnt = 0;
  _adjust_scroll_v(_this, _this.data.length);

  // 하나의 row 를 추가해 주는 function
  function append_row (from, to, end, temp_row, inputs, _this){
    
    // cell 에 id 를 입력한다
    function set_cell_id (i, j, _this) {
      const element= _this.scheme[j].element;
      const _div   = (j < _this.cfg.fixed_header) ? 0 : 1;
      const query  = `${element}[col=${j}]`;
      const id     = `${_this.get_id()}_cell_${i}_${j}`;
      _this.cell[i][j] = _this.rows[i][_div].find(query).attr({id, row: i});
    }
    
    // drill 모드일 경우 gen_label 을 셋팅한다
    function set_gen_label (i, k, _this) {
      if('gen_label' === _this.scheme[k].type){
        // drill_cell 과 drill_btn 할당
        _this.drill_cell[i] = _this.cell[i][k];
        _this.drill_btn[i]  = _this.buttons.drill_btn_minus.clone(true, true);

        // cell 에 드릴 버튼과  텍스트 입력용 span 을 append 한다.
        const $input = $('<span>');
        _this.cell[i][k].empty()
             .append(_this.drill_btn[i], $input);
        
        // getter, setter 가 제대로 작동하도록 cell 에 span 을 입력한다.
        _this.cell[i][k] = $input;
      }
    }
    
    // row 를 셋팅한다
    function set_row (i, m, _this) {
      _this.rows[i][m].get(0).setAttribute('id', `${_this.get_id()}_row_${m}_${i}`);
      _this.rows[i][m].get(0).setAttribute('row', i);
      _this.div[2][m].append(_this.rows[i][m]);
    };

    const scheme_length = _this.scheme.length;
    
    _.range(from, to).forEach( (i) => {

      _this.rows[i] = [ temp_row[0].clone(true, true), temp_row[1].clone(true, true)];
      _this.cell[i] = [];

      for(var j = 0; j < scheme_length; ++j)
        set_cell_id(i, j, _this);  // cell 에 id 를 부여한다

      // drill 모드라면 gen_label 을 설정해 준다
      if(_this.get_gen_col() >= 0)
        for(var k = 0; k < end; ++k)
          set_gen_label(i, k, _this);  

      set_row(i, 0, _this);
      set_row(i, 1, _this);
      
      return;
    }); // end of _.range.forEach

    _this.scroll_v_inner.height(to * _this.cfg.row_height);
    return; 
  } // end of append_row

  return _this; 
};

/**
 * header cell 을 생성한다
 * @param div_index
 * @param start
 * @param end
 * @returns {FGR}
 */
function _create_header(div_index, start, end){

  function blur_func () {
    this.blur();
  };
  
  const range = _.range(start, end);
  
  this.header_labels.forEach((v, row) => {
    range.forEach((col) => {

      const column = this.scheme[col];

      const cell   = $('<div>',{row, col, col_merge: 1, row_merge: 1, 'class': _style.cell})
        .height(this.cfg.row_height)
        .width(column.width)
        .css({ left: column.left, top: row * this.cfg.row_height })
        .appendTo(this.div[0][div_index]);

      const inner = _create_header_cell_inner.call(this, row, col, column, v[col])
        .attr('align', column.h_align)
        //.focus(blur_func)
        .focus(blur_func)
        .appendTo(cell);
    });
  });

  return this;
};

/**
 * header_cell_inner 를 생성한다
 * @param row
 * @param col
 * @param cell_scheme
 * @returns
 */
function _create_header_cell_inner(row, col, cell_scheme, label){

  const def  = this.get_cell_define()['str_label'];
  const attr = {
      row,
      col,
      type    : /^\&(checkbox|radio)$/.test(label) ? label.slice(1) : def.type,
      name    : cell_scheme.name,
      //readonly: ! (type.match(/check|radio/i)),
      readonly: true,
      'class' : _style.label,
  };

  const ret = $(`<${def.element}>`, attr)
      .val(label)
      .css('text-align', cell_scheme.h_align)
      .height(_style.row_height - 1);

  return ret; 
};

/**
 * 헤더 레이블을 2차원 배열로 생성해 리턴한다
 * @param _this
 * @returns {Array}
 */
function _get_header_labels_array(){

  const temp   = this.scheme.map((col) => col.label.split('||') );
  const range  = _.range(_.max(temp.map((v) => v.length)));
  const labels = range.map((r) => []);
  
  // temp 배열을 pivot 하여 labels 배열을 완성한다.
  range.forEach((i) => {
    this.scheme.forEach((v, j) => { 
      labels[i][j] = temp[j][i] 
    });
  });
  return labels;
};

/**
 * 헤더 레이블 cell 객체를 찾아 리턴해 준다
 * @param row
 * @param col
 * @returns
 */
FGR.prototype.get_header_cell = function (row, col){

  if(this.header_cells[row] && this.header_cells[row][col]) return this.header_cells[row][col];

  const _this = this;
  const div   = this.div[0][(col >= this.cfg.fixed_header) ? 1 : 0];
  const $cell = div.find('.' + _style.cell).filter(function(){
        const loc = _this.get_loc(this);
        return loc.row === row && loc.col === col;
      });

  this.header_cells[row][col] = ($cell.length === 1) ? $cell : null;
  return $cell;
};

/**
 * 헤더 레이블에 대하여 수직 merge 작업을 수행한다
 * @returns {FGR}
 */
function _create_merge_v_header(){

  const labels  = this.header_labels;
  const col_cnt = this.scheme.length;
  const row_cnt = this.header_labels.length;

  _.range(col_cnt).forEach((col) => {
    for (var row = row_cnt - 1; row > 0; --row) {
      if(labels[row][col] === undefined){
        const upper_cell   = this.get_header_cell(row-1, col);
        const this_cell    = this.get_header_cell(row,   col);
        const upper_height = upper_cell.height();
        const this_height  = this_cell.height();

        if(upper_cell.width() === this_cell.width()){
          var this_merge_cnt  = _toInt( this_cell.attr('row_merge')),
            upper_merge_cnt = _toInt(upper_cell.attr('row_merge'));

          this_cell.remove();
          upper_cell.height(upper_height + this_height);
          upper_cell.attr('row_merge', this_merge_cnt + upper_merge_cnt);
        } // end of if upper_cell
      } // end of if labels 
    } // end of row loop 
  }); // end of col loops
  return this;
};

/**
 * 헤더 레이블에 대하여 수평 merge 작업을 수행한다
 * @returns {FGR}
 */
function _create_merge_h_header(){

  const labels    = this.header_labels;
  const row_range = _.range(this.header_labels.length);

  function merge_job (start_col, end_col) {
    
    row_range.forEach((row) => {
      for(var col = end_col - 1; col > start_col; --col){
        const is_no_check = ! /radio|check/i.test(this.scheme[col].type);

        if(is_no_check && labels[row][col - 1] === labels[row][col]){
          const left_cell = this.get_header_cell(row, col-1);
          const this_cell = this.get_header_cell(row, col  );

          if(left_cell.height() === this_cell.height()){
            const this_merge_cnt = _toInt(this_cell.attr('col_merge'));
            const left_merge_cnt = _toInt(left_cell.attr('col_merge'));

            this_cell.attr('removed', true).remove();
            left_cell.width(left_cell.width() + this_cell.width());
            left_cell.attr('col_merge', this_merge_cnt + left_merge_cnt);
          }
        }
      }
    }); // end of row_range.forEach
  }

  const fence   = this.cfg.fixed_header;
  merge_job.call(this, 0, fence);
  merge_job.call(this, fence, this.scheme.length);
  return this;
};

/**
 * 헤더 셀 내부 수직 정렬을 조절한다
 */
function _create_adjust_header_cell_v_loc(_this){

  function adjust () {
    const $this = $(this);
    const $input= $this.find('input');
    const top   = ($this.height() - _this.cfg.row_height) / 2;

    $input.css('top', top);
    if(/checkbox|radio/.test($input.attr('type'))){
      $input.height(_this.cfg.checkbox_size)
            .width('100%');
    }
  } // end of function

  const query = '.' + _style.cell;
  _this.div[0][0].find(query).each(adjust);
  _this.div[0][1].find(query).each(adjust);
  return _this;
};

/**
 * 데이터 row 의 프로토타입을 생성한다
 * @param start
 * @param end
 * @param row_width
 * @returns
 */
function _create_proto_row(start, end, row_width){
  const row  = $('<div>').addClass(_style.row).height(this.cfg.row_height);
  _.range(start, end).forEach( (i) => {
    this.proto.cell[i].clone(true, true).appendTo(row);
  });
  return row;
};

/**
 * 각 컬럼별 cell 의 프로토타입을 생성한다
 * @param element : 특정 tag 명을 지정해 줄 경우에만 사용
 * @returns {Array}
 */
function _create_proto_cell(element, mode){

  const cell_height = this.cfg.row_height;
  
  const cells = this.scheme.map((column, i) => {
    const adj   = ('select' === column.type) ? 0 : 1;
    const $cell = _create_cell.call(this, column, element, i, cell_height - adj, mode)
                              .addClass(`${this.get_id()}_col_${i}`);
    return $cell;
  });
  return cells;
};

/**
 * 각 셀의 left 좌표를 계산한다
 * @returns {FGR}
 */
function _set_cell_left_array(){
  var len = this.scheme.length;
  for (var i = 0, left = 0; i < len; ++i) {
    if(i === this.cfg.fixed_header)
      left = 0;
    this.scheme[i].left = left;
    left += this.scheme[i].width;
  }
  return this;
};

/**
 * 데이터 셀을 생성한다.
 * @param _this
 * @param cell_scheme
 * @param element : element tag 를 고정할 때 사용한다
 * @returns
 */
function _create_cell(cell_scheme, element, index, height, mode){

  const set         = this.get_cell_define()[cell_scheme.type];
  const is_select   = (set.element === 'select');
  const is_calc_row = mode === 'calc_row';
  const is_checkbox = /check|radio/.test(cell_scheme.type);

  var evt_name, evt_function;

  // 1. cell attribute 설정
  const attr = {
    id     : `${this.get_id()}_proto_col_${index}`,
    name   : cell_scheme.name,
    col    : index,
    'class': (is_calc_row && is_checkbox) ? _style.idiv : set.style,
    type   : is_calc_row ? 'text' : set.type
  };
  
  if(_.isNumber(cell_scheme.size)) attr.maxlength = cell_scheme.size;

  // 2. 사용자 입력 cell 생성
  const cell = $(`<${element || set.element}>`, attr);

  // 2.1. select 인 경우 option 을 붙여준다.
  if(!element && is_select && set.child)
    cell_scheme[set.scheme].forEach((v) => $('<' + set.child + '>', v).appendTo(cell) );

  // 3. 이벤트 bind
  if(!element && set.event) {
    _.map(set.event, (func, evt_name) => cell[evt_name](func) );
  }

  // checkbox, radio 인 경우의 처리
  if(!is_calc_row && is_checkbox){
    cell.height(this.cfg.checkbox_size).width('100%');
    const cell_outer = $('<div>', {'class': _style.idiv}).append(cell);
    cell_outer.css('padding-top', (this.cfg.row_height - this.cfg.checkbox_size) / 2);
    return cell_outer;
  } else {
    cell.height(height);
    return cell;
  }
};


/**
 * 컬럼별로 적용할 css class 를 생성한다
 * @param col_index
 * @returns {FGR}
 */
function _create_col_style(_this, col_index){

  _.range(col_index, _this.scheme.length).forEach((i) => {

    const v       = _this.scheme[i];
    const set     = _this.get_cell_define()[v.type];
    const _width  = v.width + set.width_adj;
    const css_name= `${_this.get_id()}_col_${i}`;
    const is_hide = _width <= 0;

    const attr = {
      'text-align': v.align,
      'left'      : v.left + 'px',
      'width'     : (is_hide) ? (0 + 'px') : (_width + 'px'),
      'display'   : (is_hide) ? 'none'     : 'inline',
      'background-color': (v.bg_color) ? v.bg_color : 'transparent'
    };
    
    const exp_header = '.' + css_name + ' {';
    const exp_body   = _.reduce(attr, (before, current, key) => ( before + key + ':' + current + ';'), '');
    const exp_tail   = '}';
    
    _insert_new_styles(_this, css_name, exp_header + exp_body + exp_tail);

  });
  return this;
};

/**
 * row 생성을 위한 초기 데이터를 생성한다
 * @returns {Array}
 */
FGR.prototype.create_init_data = function(row_count){
  const row_cnt = row_count || this.cfg.rows_show;
  const row     = this.scheme.map((col) => col.init_data);
  return _.range(row_cnt).map(() => [...row]);
};

/**
 * 버튼들의 프로토타입을 생성한다. clone 하여 사용하면 된다.
 * @returns {obejct}
 */
function _create_buttons(_this){
  return {
    drill_btn_minus: $('<button>').text('-')
      .click(drill)
      .dblclick(drill_straight)
      .addClass(_style.drill_btn)
  };
  
  function drill(event){

    const gen_col    = _this.get_gen_col();
    const row        = _toInt($(this).attr('row'));
    const parent_row = _this.data[row];
    const top_gen    = parent_row[gen_col];
    const flag       = {};

    flag[top_gen] = parent_row;

    if(! parent_row.children){
      // drill up
      
      // loop : makeTree
      for (var i = row + 1; i < _this.data.length; i++) {
        const this_row = _this.data[i];
        const gen      = this_row[gen_col];
        
        // drill 작업이 끝나면 break;
        if(gen <= top_gen) break;

        // drill up 은 하위 아이템을 숨기는 작업이기 때문에 각 아이템의 부모가 누구인지를 잘 지정해 줘야 한다.
        // flag 는 각 아이템의 부모가 될 아이템을 gen 넘버별로 모아놓는 곳이다.
        flag[gen] = this_row;

        // 1 단계 위 부모가 존재한다면 자식으로 등록하고, 숨김 대상으로 지정한다.
        if(flag[gen - 1]){
          if( ! flag[gen - 1].children){
            flag[gen - 1].children = [];
          }
          this_row.hide = true;
          flag[gen - 1].children.push(this_row);
        }
      } // end of loop : makeTree
      
      // 숨김 대상을 제외한 나머지 데이터만 보여준다.
      const temp_data = [];
      for (var i = 0; i < _this.data.length; i++) {
        const this_row = _this.data[i];
        if( ! this_row.hide)
          temp_data.push(this_row);
      }
      _this.data = temp_data;
      // end of drill up
    } else {
      // drill down

      remove_empty_rows();

      // 숨김 표시를 해제한다.
      const temp_row = parent_row.children.map(function(r){ r.hide = false; return r;});
      const head     = _this.data.slice(0, row + 1);
      const tail     = _this.data.slice(row + 1);
      
      _this.data = head.concat(temp_row, tail);
      parent_row.children = undefined;
      
    } // end of drill down

    if(_this.data.length < _this.rows.length){
      const last       = _this.rows.length - _this.data.length;
      const empty_rows = _this.create_init_data(last).map((row) => { row.empty = true; return row; });
      _this.data = _this.data.concat(empty_rows);
    }
    
    _this.data.forEach(function(r, index){ r.index = index; });
    
    _adjust_scroll_v(_this, _this.data.length);  // scroll bar 조정
    _this.refresh();
    event.preventDefault();
    
    // end of drill down
  }

  // 더블클릭시에는 모든 자식 node 를 전부 열어 보여준다
  function drill_straight(event){

    const row        = _toInt($(this).attr('row'));
    const parent_row = _this.data[row];

    if( ! _.isArray(parent_row.children)) return;
    
    const temp_head = _this.data.slice(0, row + 1);
    const temp_body = parent_row.children;
    const temp_tail = _this.data.slice(row + 1);

    // children 이 딸린 tree 구조의 배열을 하나의 배열로 평탄화하는 함수 
    function platten (array) {
      
      var arr = array;

      for (var i = 0; i < arr.length; i++) {
        const _row = arr[i];
        if(_row.children){
          const head = arr.slice(0, i + 1);
          const body   = _row.children;
          const tail   = arr.slice(i + 1);
          _row.children = undefined;
          arr = head.concat(body, tail);
        }
      }
      return arr.map(function(r){ r.hide = undefined; return r; });
    }
    
    // start drill straight open
    parent_row.children = undefined;
    
    // 버튼을 누른 행의 자식을 평탄화하여 하나의 배열로 만드는 작업을 한다.
    _this.data = temp_head.concat( platten(temp_body), temp_tail );

    // empty rows 를 제거하고 화면을 refresh 한다.
    remove_empty_rows();
    _this.refresh();
    _adjust_scroll_v(_this, _this.data.length, true, true);   // scroll bar 조정
    
    event.preventDefault();
  }

  function remove_empty_rows(){
    for(var i = _this.data.length - 1; i >= 0; --i){
      if(_this.data[i].empty)
        _this.data.pop();
      else
        break;
    }
    return;
  }
};

/**
 * 정렬에 사용되는 펑션 모음
 * @param col
 * @returns {object}
 */
FGR.prototype.sort_func = function(col){
  return {
    number_asc (a,b) {
      if(a[col] === null) return 1;
      if(b[col] === null) return -1;
      return  a[col] - b[col];
    },
    number_desc (a,b) {
      if(a[col] === null) return 1;
      if(b[col] === null) return -1;
      return -a[col] + b[col];
    },
    str_asc (a,b) {
      if(a[col] === null || a[col] === '') return 1;
      if(b[col] === null || b[col] === '') return -1;
      return (a[col] < b[col]) ? -1 : 1;
    },
    str_desc (a,b) {
      if(a[col] === null || a[col] === '') return 1;
      if(b[col] === null || b[col] === '') return -1;
      return (a[col] > b[col]) ? -1 : 1;
    },
    revert (a,b) {
      return  a.index - b.index;
    },
  };
};

// setting functions ---------------------------------------------------
/**
 * 헤더 div size 를 조정한다.
 * @returns {FGR}
 */
function _div_size_adjust(){
  this.div[0][1]
    .width(this.cfg.right_width)
    .height(this.header_labels.length * this.cfg.row_height);
  this.div[0][0]
    .width(this.cfg.left_width)
    .height(this.header_labels.length * this.cfg.row_height);
  return this;
};

/**
 * 사이즈 설정 초기화
 * @param _this
 * @returns {object}
 */
function _size_setting() {

  function _add_func (a, b) {
    return a + b;
  }

  const cfg        = this.cfg;
  const scheme     = this.scheme;
  const start      = 0;
  const fence      = cfg.fixed_header;
  const end        = scheme.length;
  const border     = cfg.border_size = 0;
  const is_cols    = _.isNumber(cfg.cols_show) && cfg.cols_show > 0;
  const is_rows    = _.isNumber(cfg.rows_show) && cfg.rows_show > 0;
  const show_width = _.chain(scheme).slice(fence, fence + cfg.cols_show).pluck('width').reduce(_add_func, 0);

  cfg.header_height    = this.header_labels.length * cfg.row_height + 1;
  
  cfg.left_width = _.chain(scheme).slice(start, fence).pluck('width').reduce(_add_func, 0); // row_label width : 왼쪽
  cfg.right_width = _.chain(scheme).slice(fence, end).pluck('width').reduce(_add_func, 0); // data_table width: 오른쪽
  
  cfg.right_width_show = is_cols ? show_width + (border * cfg.cols_show)  // cols_show 옵션이 있다면 width 를 계산한다
    : cfg.width - cfg.left_width;                                       // 옵션이 없다면 주어진 width 값을 사용한다

  if(is_rows)
    cfg.height = cfg.row_height * cfg.rows_show;  // rows_show 설정이 있는 경우 height 를 계산한다

  cfg.scroll_v_height = cfg.height;

  if(cfg.calc_row === 'top')
    cfg.height += cfg.row_height;

  cfg.wheel_move = cfg.row_height * cfg.wheel_move_row;  // 마우스 휠을 한 번 굴릴 때의 이동 거리

  cfg.scroll_bar_width = this.get_scroll_bar_width();
  return cfg;
};

/**
 * DIV 객체 초기화
 * @param _this
 * @returns {object}
 */
function _div_setting(){

  function create_div (_this, id) {
    return $('<div>', {id: _this.get_id() + id, 'class': id});
  }

  const div = { 
      0: [], 1: [], 2: [], 3: [], 4: [],
      main : $(`#${this.get_id()}`).addClass(_style.main_div),
  };
  const div_alias  = [  // div 알리아스 정의
      ['top_corner', 'col_label',  'top_empty'],
      ['calc_left',  'calc_right', 'calc_empty'],
      ['row_label',  'data_table', 'scroll_v'],
      ['bot_empty',  'scroll_h',   'bot_corner'],
      ['bot_paging'] ];

  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 3; j++) {
      const div_id = `_fg_div_${i}${j}`;
      const alias  = div_alias[i][j];
      div[i][j] = div[alias] = create_div(this, div_id);
    }
  }
  div[4][0] = div.bot_paging = create_div(this, '_fg_div_40');


  const left_height   = (this.cfg.header_height + this.cfg.height);
  const bottom_height = (this.cfg.calc_row === 'bottom') ? this.cfg.row_height : 0;
  const _height       = left_height + bottom_height;

  div.left      = create_div(this, '_fg_div_left').height(_height);
  div.right     = create_div(this, '_fg_div_right').height(_height);
  div.bot_left  = create_div(this, '_fg_div_bot_left').append(div.bot_empty);
  div.bot_right = create_div(this, '_fg_div_bot_right').appendTo(div.scroll_h);

  if(this.cfg.calc_row === 'bottom'){
    div.left .append(div[0][0], div[2][0], div[1][0]);
    div.right.append(div[0][1], div[2][1], div[1][1]);
  } else {
    div.left .append(div[0][0], div[1][0], div[2][0]);
    div.right.append(div[0][1], div[1][1], div[2][1]);
    div.bot_right.css('border-bottom', '0px');
    div[3][0].css('border-bottom', '0px');
  }

  div.cover = create_div(this, '_fg_div_cover').appendTo(div.main);
  div.under_line_left  = $('<div>', {style: 'border-top:' + _style.row_bot_line});
  div.under_line_right = $('<div>', {style: 'border-top:' + _style.row_bot_line});
  return div;
};

/**
 * 메인 테이블 생성, 각 td 에 div 셋팅
 * @param _this
 * @returns {object}
 */
function _tbl_setting(){

  function create_simple_table(_this, row, col, attribute) {

    function create_tr () { return $('<tr>'); };
    function create_td () { return $('<td>', {height: _this.cfg.row_height, valign: 'top'}); };

    const col_range = _.range(col);
    const $tbl      = $('<table>', attribute);
    
    _.range(row).forEach(() => {
      const $tr = create_tr().appendTo($tbl);
      col_range.forEach( () => create_td().appendTo($tr) );
    });
    return $tbl;
  };

  const attr = {
    id      : `${this.get_id()}_fg_main_table`,
     'class': '_fg_main_table',
     border : 0, cellspacing : 0, cellpadding : 0,
  };
  const tbl  = {
    main : create_simple_table(this, 3, 3, attr).appendTo(this.div.main)
  };
  const $tds = tbl.main.find('tr:eq(1) td');
  const $tr  = tbl.main.find('tr').eq(2).empty();  // bot_paging 영역 확보

  // main table 각각의 td 에 미리 생성해 둔 div 를 append 한다.
  tbl.main.find('tr:eq(0) td:eq(0)').append(this.div.left);
  tbl.main.find('tr:eq(0) td:eq(1)').append(this.div.right);
  tbl.main.find('tr:eq(0) td:eq(2)').append(this.div.scroll_v).attr({valign: 'bottom'})
          .css({'padding-bottom': (this.cfg.calc_row === 'bottom') ? this.cfg.row_height+1 : 0});

  ;['bot_empty', 'scroll_h', 'bot_corner'].forEach((v,i) => $tds.eq(i).append(this.div[v]) );

  // paging 옵션이 설정되어 있다면 index button 이 들어갈 공간을 준비한다.
  if(this.cfg.paging){
    $('<td>', {colspan : 3})
      .append(this.div[4][0].attr({align: 'center'}))
      .appendTo($tr);
  } else {
    $tr.css('background-color','red').remove();
  }
  return tbl;
};

/**
 * 그리드 상의 데이터 뷰를 갱신한다
 * @returns {FGR}
 */
FGR.prototype.refresh = function(){
  this.render_data(this, this.current_top_line);
  return this;
};

/**
 * data cell 에 값을 입력하거나, 값을 가져온다
 * 예)
 *  Cell_value(3,2)     : 3 row, 2 col 의 값을 가져온다  (getter)
 *  Cell_value(3,2, 77) : 3 row, 2 col 에 77 을 입력한다 (setter)
 * @param row
 * @param col
 * @param value
 * @returns
 */
FGR.prototype.Cell_value = function(row, col, value){
  const $cell  = this.cell[row][col];
  const scheme = this.scheme[col];
  const func   = (value === undefined) ? scheme.getter : scheme.setter;
  return func($cell, value, row, col, this);
};

/**
 * data cell 에 값을 입력한다.
 * 예)
 *  Set_cell_value(3,2, 77) : 3 row, 2 col 에 77 을 입력한다 (setter)
 * @param row
 * @param col
 * @param value
 * @returns
 */
FGR.prototype.Set_cell_value = function(row, col, value){
  const $cell = this.cell[row][col];
  return this.scheme[col].setter($cell, value, row, col, this);
};

/**
 * 화면에 데이터를 보여주는 data render 펑션
 * 이 펑션은 일반적인 방법으로 호출되지 않으며, data_render 변수에 담겨 호출된다
 * @param _this
 * @param row_cnt : 렌더링할 데이터의 가장 윗 줄 index
 * @returns
 */
function _show_data(_this, row_cnt) {
  
  const len = _this.scheme.length;
  const rsh = _this.cfg.rows_show;
  let i, j;

  for(i = 0; i < rsh; ++i){
    const row     = row_cnt + i;
    const one_row = _this.data[row];

    if(one_row){
        if(one_row.bg_color === undefined) one_row.bg_color = 'transparent';

        _this.paint_one_row(i, one_row.bg_color);

        for(j = 0; j < len; ++j){
          _this.cell[i][j].attr('row', row);
          _this.Set_cell_value(i,j, one_row[j]);
        }
    }
  }
  _this.show_highlight_bar();
  return _this;
};

/**
 * 드릴 다운 기능이 설정되었을 경우 사용되는 data render 펑션
 * 이 펑션은 일반적인 방법으로 호출되지 않으며, data_render 변수에 담겨 호출된다
 * @param _this
 * @param row_cnt
 * @returns {FGR}
 */
function _show_drill_data(_this, row_cnt) {
  
  const len = _this.scheme.length;
  const rsh = _this.cfg.rows_show;
  let i, j;

  for(i = 0; i < rsh; ++i){
    const row     = row_cnt + i;
    const one_row = _this.data[row];

    if(one_row){

        for(j = 0; j < len; ++j){
          // 값 표현
          _this.cell[i][j].attr('row', row);
          _this.Set_cell_value(i,j, one_row[j]);
        }
        
        // gen_label 처리
        const gen_col  = _this.get_gen_col();
        const label_col= _this.get_gen_label_col();
        const gen      = one_row[gen_col];
        const next_row = ((row + 1) < _this.data.length) ? _this.data[row+1] : undefined;
        const next_gen = next_row ? next_row[gen_col] : -1;
        const btn      = _this.drill_btn[i];
        const indent   = _style.drill_indent * gen;

        btn.attr({ row, gen });
        _this.drill_cell[i].css('padding-left', indent);
        _this.drill_cell[i].width(_this.scheme[label_col].width - indent - _style.input_padding);
        
        if (one_row.children) {
          // 현재 row 가 children 을 숨기고 있다면 + 버튼을 보여준다.
          btn.show();
          btn.text('+');
        } else if(gen < next_gen){
          // 현재 row 가 부모인 경우 - 버튼을 보여준다.
          btn.show();
          btn.text('-');
        } else {
          // 현재 row 가 부모가 아닌 경우 버튼을 숨긴다.
          btn.hide();
        }

        // 배경색 처리
        if(one_row.bg_color === undefined) 
          one_row.bg_color = 'transparent';
        _this.paint_one_row(i, one_row.bg_color);

    } else {
        _this.drill_btn[i].hide();
        _this.data[row] = _this.create_init_data(1)[0];
        _this.data[row].empty = true;
      
      for(j = 0; j < len; ++j){
        // 값 표현
        _this.cell[i][j].attr('row', row);
        _this.Set_cell_value(i,j, _this.data[row][j]);
      }
    }
  }
  _this.show_highlight_bar();
  return _this;
};

/**
 * cell 객체의 데이터 상의 좌표를 구한다
 * @param cell : (DOM element) input 이나 select 등 cell 역할을 하는 엘리먼트
 * @returns {row, col}
 */
FGR.prototype.get_loc = function(cell){
  return {row: _toInt(cell.getAttribute('row')), col: _toInt(cell.getAttribute('col'))};
};

/** highlight bar 를 표시하고 cursor focused 를 이동한다. */
FGR.prototype.show_highlight_bar = function(){

  if( ! this.highlight_refresh){
    this.highlight_refresh = true;
    return this;
  }

  if(this.highlight_row < 0) return this;

  if(this.pre_cell) this.pre_cell.attr('disabled', false);

  if(this.row_selected >= this.current_top_line && this.row_selected < this.current_top_line + this.rows.length){
      // selected row 가 화면 내에 있다면

      const editable = this.is_editable_cell(this.row_selected, this.col_selected);

      this.highlight_row = this.row_selected - this.current_top_line;
      this.paint_one_row(this.highlight_row, _style.row_selected);
      
      if(this.col_selected && ! editable)
        this.pre_cell = this.cell[this.highlight_row][this.col_selected].attr('disabled', true);
      else if(this.col_selected && editable) 
        this.cell[this.highlight_row][this.col_selected].focus();
  } else {
    // IE8 인 경우 $(':focus').blur() 를 사용하게 되면 IE8 자체 버그가 발생한다
    if(this.is_IE())
      this.div[0][1].focus();  
    else
      $(':focus').blur();
  }
  return this;
};

/**
 * 하나의 row 를 색칠한다
 * @param index : 화면상의 row index (data index 가 아님)
 * @param color
 * @returns {FGR}
 */
FGR.prototype.paint_one_row = function(index, color){
  for (var i = 0; i < 2; i++)
    this.rows[index][i].css('background-color', color);
  return this;
};

/**
 * 하나의 row 를 숨긴다
 * @param index
 * @param is_hide
 * @returns {FGR}
 */
FGR.prototype.hide_one_row = function(index, is_hide){
  for (var i = 0; i < 2; i++)
    this.rows[index][i][is_hide ? 'hide' : 'show']();
  return this;
};

/**
 * 수직 스크롤의 길이를 조절한다
 * @param row_count : (number || string) 스크롤의 길이 조절 참고용 row 의 숫자
 * @returns {FGR}
 */
function _adjust_scroll_v(_this, row_count){

  const scroll = (_this.data.length > _this.cfg.rows_show) ? 'scroll' : 'hidden';
  const cnt = (() => {
    if(row_count === 'visible')
      return _this.div.data_table.find(`.${_style.row}:visible`).length;
    else if(_.isNumber(row_count))
      return row_count;
  })();

  const scroll_height = cnt * _this.cfg.row_height;
  _this.scroll_v_inner.height(scroll_height);
  _this.div.scroll_v.css('overflow-y', scroll);

  return _this;
};

/**
 * row_label 과 data_table 의 홀수행과 짝수행의 배경색을 다르게 칠한다
 * @param _this
 */
FGR.prototype.paint_rows = function(_this){
  function paint (query, color) {
    for(var i = 0; i<2; ++i)
      _this.div[2][i].find('.' + _style.row + query).css('background-color',color);
  };

  paint(':odd', _style.row_color_odd);
  paint(':even', _style.row_color_even);
  return this;
};

/**
 * 포커스 위치를 상/하 방향으로 움직인다. 움직이는 단위는 1 row, 또는 1 page
 * 이 펑션은 키 입력을 받아 움직이도록 하고, 다른 용도로는 가급적이면 호출하지 않도록 한다
 * @return {Boolean} 네비게이션 키 입력을 받았다면 true 를 리턴하고, 그 외의 경우에는 false 를 리턴한다
 */
function _move_focus(e, _this) {

  // 고의로 움직임에 딜레이를 준다. 키를 계속 누르고 있을 경우, 
  // IE 처럼 처리 느린 웹 브라우저의 스크롤링 속도는 큰 변화가 없지만,
  // chrome 처럼 빠른 웹 브라우저에서는 너무 빨라서 잔상 비슷한 효과가 난다.
  if(_this.move_delay) return false;

  _this.move_delay = true;
  setTimeout(function(){ _this.move_delay = false;}, _this.scroll_delay_ms);

  if(e.keyCode === 13) e.preventDefault();

  // 13: Enter, 33: pgup, 34: pgdn, 38: ↑, 40: ↓
  const keys  = {
    13:  1,
    33: -_this.cfg.rows_show,
    34:  _this.cfg.rows_show,
    38: -1,
    40:  1, 
  }; 

  // keys 에 정의된 키 코드가 아니라면 return
  if( ! keys.hasOwnProperty(e.keyCode)) return false;

  const loc      = _this.get_loc(e.target);
  const row      = loc.row;
  const row_cnt  = keys[e.keyCode];  // 입력한 키에 따라 스크롤 할 row 의 수를 가져온다.
  const this_row = row - _this.current_top_line;
  const check    = {'-1': this_row === 0, 1: this_row >= _this.rows.length - 1};

  // 1. ↑, ↓ 입력이 들어온 경우
  if(check.hasOwnProperty(row_cnt)){

      // A. 현재 커서 위치가 최상단, 최하단이라면
      if(check[row_cnt]){
        _this.row_selected = row + row_cnt;

        if(_this.row_selected < 0) _this.row_selected = 0;

        _this.scroll_row(row_cnt);

      // B. 현재 커서 위치가 최상단, 최하단이 아니라면
      } else {
        const next_row = _this.cell[this_row + row_cnt];

        if(next_row) next_row[loc.col].mousedown().focus();
      }

  // 2. pgup, pgdn 입력이 들어온 경우
  } else {
    const top = _this.div.scroll_v.scrollTop();

    _this.row_selected = row + row_cnt;
    _this.div.scroll_v.scrollTop(top + _this.cfg.row_height * row_cnt);
    _this.scroll_row(row_cnt);
  }
  return true;
};

/**
 * paste event (control + v 키 이벤트)
 * 엑셀의 여러 셀을 선택해 복사해 온 값을 그리드 화면에 붙여넣는 기능이다. 현재 복사하기/잘라내기 기능은 구현하지 않았다.
 * 복사하기/잘라내기 기능은 그리드 자체에서 구현하기보다는 '엑셀 파일/csv 형식으로 다운로드' 기능을 사용하는 쪽이 합리적이다.
 */
function _attatch_evt_paste(_this){

  // https://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
  function get_clipboard_text (e) {
    if(window.clipboardData)
      return window.clipboardData.getData('text'); // #forInternetExplorer
    return (e.originalEvent || e).clipboardData.getData('text/plain');
  }

  function paste (e) {

    e.preventDefault();
    
    function indexing (v, i) {
      return v.split('\t').map( (vv, j) => ({row: row + i, col: col + j, txt: vv }) ); 
    };

    const $cell = $(e.target);
    const row   = _toInt($cell.attr('row'));
    const col   = _toInt($cell.attr('col'));

    $cell.val(null);

    // 값을 행, 열로 잘라 셀에 입력한다
    get_clipboard_text(e)
      .split(/\r\n|\r|\n/)
      .map(indexing)
      .every(function(line, i){
        if( ! _this.data[row + i]) return false;
      
        line.forEach(insert_one_row);
        return true;
      });
    _this.refresh();  // 화면을 갱신해 보여준다.
    return;
  } // end of function paste

  const isEmpty = (function(){
    const reg = /^\s*$/;
    return (str) => reg.test(str); 
  })();

  function insert_one_row (dt) {
    // 존재하지 않는 컬럼이라면 pass
    if(! _this.scheme[dt.col]) return true;
    // editable 셀이 아니라면 pass
    if( ! _this.is_editable_cell(dt.row, dt.col)) return true;

    _this.data[dt.row][dt.col] = _this.scheme[dt.col].data_push(undefined, dt, dt.txt);  // this.data 에 값을 입력한다.
  }

  for(var i = 0; i < 2; ++i)
    _this.div[2][i].bind('paste', paste);

  return _this; 
};

/**
 * 상단 계산 행을 추가한다
 * @returns {FGR}
 */
function _create_calc_row(){

  if( ! this.cfg.calc_row) return this;

  this.scheme.forEach((v,i) => {
    const div  = (i < this.cfg.fixed_header) ? 'calc_left' : 'calc_right';
    const attr = {
      readonly : true,
      id       : `${this.get_id()}_calc_cell_${i}`,
      disabled : v.type.match(/check|radio/),
    };

    this.calc_cell[i].attr(attr).css('border-left', '1px solid transparent').appendTo(this.div[div]);

    if(attr.disabled) this.calc_cell[i].find('input').attr('disabled', true);
  });
  return this;
};

/**
 * 상단 계산 행에 들어갈 값을 계산한다
 * @param col_index
 */
FGR.prototype.calc_calc_cell = function(col_index){

  const col = this.scheme[col_index];

  if(col.calc_row === undefined) return '';

  // col.calc_row 의 값으로는 'sum', 'avg', 'max', 'min' 등, FGR.prototype.calc 에 정의된 값들이 들어간다.
  const calc_result = this.calc[col.calc_row](this, col_index);
  return col.calc_title + calc_result;
};

/**
 * 계산 행에서 사용할 function 모음
 * sum : 총합을 계산한다
 * avg : 산술 평균을 계산한다
 * max : 최대값을 계산한다
 * min : 최소값을 계산한다
 */
FGR.prototype.calc = {
  sum (_this, col_index) {
    const value = _this.data.reduce((a,b) => ( a + b[col_index]), 0)
    return _to_comma_format(value);
  },
  avg (_this, col_index) {
    for(var i = 0, cnt = 0, sum = 0; i < _this.data.length; ++i){
      const v = _this.data[i][col_index];
      if(!_.isNull(v)){
        sum += v;
        ++cnt;
      }
    }
    return (sum/cnt).toLocaleString('en');
    //return _to_comma_format(sum/cnt);
  },
  max (_this, col_index) {
    var max = Number.MIN_SAFE_INTEGER;

    _this.data.forEach(function(v,i){
      const val = v[col_index];
      if(val == null)
        return true;
      else if(val > max)
        max = val;
    });

    if(max <= Number.MIN_SAFE_INTEGER){
      return (max = '');
    } else {
      return _to_comma_format(max);
    }
  },
  min (_this, col_index) {
    var min = Number.MAX_SAFE_INTEGER;

    _this.data.forEach(function(v,i){
      const val = v[col_index];
      if(val == null)
        return true;
      else if(min > val)
        min = val;
    });

    if(min >= Number.MAX_SAFE_INTEGER){
      return (min = '');
    } else {
      return _to_comma_format(min);
    }
  }
};

/**
 * 상단 계산 행의 값을 갱신한다.
 * @returns {FGR}
 */
FGR.prototype.refresh_calc_cell = function(col_index){
  const _this = this;
  
  /// 계산 지정된 모든 컬럼을 게산한다.
  if(col_index === undefined) {
    this.scheme.forEach(function(v,i){
      if(v.calc_row)
        _this.calc_cell[i].val(_this.calc_calc_cell(i));
    });

  // col_index 로 지정된 컬럼만을 계산한다.
  } else if (_.isNumber(col_index)){
    if(_this.scheme[col_index].calc_row)
      _this.calc_cell[col_index].val(_this.calc_calc_cell(col_index));
  }
  return this;
};

/**
 * 스크롤 바의 너비(width) 를 구한다
 * @returns {Number}
 * @link http://chris-spittles.co.uk/jquery-calculate-scrollbar-width/
 */
FGR.prototype.get_scroll_bar_width = function() {
  const div_inner = $('<div>', {html: 'scroll test', style: 'width:100%;height:200px;'});
  const div_outer = $('<div>', {style:'width:200px;height:150px;position:absolute;top:0;left:0;visibility:hidden;overflow:hidden;'}).append(div_inner);

  $('body').append(div_outer);
  const width1 = div_inner[0].offsetWidth;
  div_outer.css('overflow', 'scroll');
  const width2 = div_outer[0].clientWidth;
  div_outer.remove();
  return width1 - width2;
};

/**
 * row_label 과 data_table 에 row 를 추가한다
 *
 * Add_row()    : 하나의 row 를 추가한다
 * Add_row(30)  : 30 개의 row 를 추가한다
 * Add_row(2, 6): 2 개의 row 를 6 번 row 에 삽입한다. 기존 6 번 row 는 아래로 밀려 내려간다
 *
 * @param number   : (number) 추가할 row 의 수
 * @param row_index: (number) 삽입할 row 의 인덱스
 * @returns {FGR}
 */
FGR.prototype.Add_row = function(number, row_index){
  
  const num      = (number === undefined) ? 1 : number;
  const valid_in = _is_number(row_index);
  const arr_head = valid_in ? this.data.slice(0, row_index) : this.data;
  const arr_add  = this.create_init_data(num);
  const arr_tail = valid_in ? this.data.slice(row_index)    : [];

  this.data = arr_head.concat(arr_add, arr_tail);

  this.data.forEach(function(row, i){ row.index = i; });  // indexing for filter
  _adjust_scroll_v(this, this.data.length);
  this.refresh();
  return this;
};

/**
 * 데이터 로드
 * @param data
 * @param callback
 * @returns {FGR}
 */
FGR.prototype.Load_data = function(data, callback, filter){

  var _this = this;
  
  // 0. 데이터 로드를 할 때마다 초기화해야 하는 변수들을 처리한다.
  _this.highlight_row     = -1;
  _this.row_selected      = -1;
  _this.col_selected      = false;
  _this.sorted            = false;
  _this.filtered          = false;
  _this.pre_filter_data   = undefined;
  _this.highlight_refresh = true;
  _this.clear_filter_condition(_this);
  _this.scroll_row(-_this.data.length * 2);  // 스크롤을 가장 위로 올린다
  
  _this.scheme.forEach(function(col){
    col.filter_icon.attr('class', _style.filter_btn);
  });
  
  // 1. this.data 변수에 데이터를 입력한다.
  (function(_this){

    var temp_data, i, j, row, value;

    // A. 2 dimention Array 의 경우
    if(Array.isArray(data) && Array.isArray(data[0])) {
      temp_data = data;

    // B. JSON Array 의 경우 (아마도 가장 일반적인 경우)
    } else if(Array.isArray(data) && _.isObject(data[0])){
      temp_data = [];

      for(i = 0; i < data.length; ++i){
        for(j = 0, row = []; j < _this.scheme.length; ++j){
          value  = data[i][_this.scheme[j].name];
          row[j] = (value === undefined) ? null : value;
        }
        temp_data[i] = row;
      }
    } else {
      //console.log('입력 데이터 형식이 2차원 배열 또는 JSON 배열이 아닙니다.');
      return false;
    }

    // 입력 데이터가 초기 데이터보다 row 수가 적은 경우를 처리한다
    if(_this.data.length > temp_data.length){
      for(i = 0; i < temp_data.length; ++i)
        for (j = 0; j < _this.data[i].length; ++j)
          _this.data[i][j] = temp_data[i][j];
    } else {
      _this.data = temp_data;
    }
    
    if(_.isFunction(filter)) _this.data = _this.data.filter(filter);

  })(this);

  // 2. 원본 데이터 보관 옵션이 true 라면 원본 데이터를 보관한다.
  if(this.cfg.save_original_data)
    this.original_data = this.data.map(function(v) { return v.slice(); });

  // 3. sort, filtering 복원 기능을 위한 인덱싱 작업을 한다
  for(var i = 0; i < this.data.length; ++i)
    this.data[i].index = i;

  // 4. 스크롤 바 처리
  this.div.scroll_v.css('overflow-y', this.data.length <= this.cfg.rows_show ? 'hidden' : 'scroll');
  _this.scroll_v_inner.height(this.data.length * _this.cfg.row_height);

  // 5. 데이터 표현
  if(this.cfg.paging) {  // 페이지 옵션이 지정되어 있다면
    //this.div[3][0].empty();  // TODO : 페이징 옵션에 대해 추가로 고민해 볼 것.
    //this.create_paging_buttons(this);
    //this.move_page(1);
    this.render_data(this, 0);
  } else if(this.cfg.drill_down){  // 드릴 다운 옵션이 있는 경우
    this.render_data(this, 0);
  } else {
    this.render_data(this, 0);
  }

  // 6. calc_cell 계산값 표현
  this.refresh_calc_cell();

  if(_.isFunction(callback)) callback();

  return this; };

/**
 * data_table 의 row 숫자를 리턴한다.
 * @returns
 */
FGR.prototype.Row_count = function(){
  return (this.data) ? this.data.length : this.div.data_table.find('.' + _style.row).length;
};

/**
 * row 를 삭제한다
 * @param row : (number) 삭제할 row 의 index 를 입력한다
 * @param col : (number) row 값으로 radio, check 등의 값을 입력할 경우 해당 컬럼의 인덱스
 * @returns {FGR}
 *
 * <p> 예제)
 * Delete_row(3);         -> 데이터 영역의 3번 row 를 삭제
 * Delete_row('all');     -> 데이터 영역의 모든 row 를 삭제
 * Delete_row([3, 1, 2]); -> 3, 1, 2 번 row 를 삭제한다
 *
 * Delete_row('check', 0); -> 0번 컬럼의 체크박스를 검사하여, 표시가 된 row 를 삭제한다
 * Delete_row('radio', 1); -> 1번 컬럼의 라디오 버튼을 검사하여, 표시가 된 row 를 삭제한다
 */
FGR.prototype.Delete_row = function(input_row, col){
  
  function is_check_type (row) {
    return /^(?:check|radio)$/i.test(row);
  };

  const _this = this;
  const row   = (input_row === undefined) ? this.data.length - 1 : input_row;

  // 1. 삭제할 target 수집
  const target_arr = (function(){
    if (is_check_type(row)) return _this.Get_checked(col);
    if (_is_number(row))    return [row];
    if (Array.isArray(row)) return row;
    if (/^all$/i.test(row)) return 'all';
    else                    return undefined;
  })();

  // 2. 삭제 작업 : deleted_data 에 백업 후 data 갱신
  if(target_arr === undefined) return this;

  if(target_arr === 'all'){
    this.deleted_data = this.deleted_data.concat(this.data);
    this.data         = this.create_init_data();
  } else {
    // 배열인 경우
    target_arr.forEach(function(v,i){ this.data[v].del = true; }, this);
    this.deleted_data = this.data.filter((row) =>  row.del);
    this.data         = this.data.filter((row) => !row.del);
    this.deleted_data.forEach(function(row){ delete row.del; });
  }

  // 3. 삭제 후, 남아있는 row 가 페이지 상의 row 수보다 적은 경우를 처리한다.
  const empty_rows = this.rows.length - this.data.length;
  if(empty_rows > 0){
    // 빈 데이터 row 를 생성한 다음, this.data 에 이어 붙인다
    const empty_data = this.create_init_data(empty_rows);
    this.data        = this.data.concat(empty_data);
  }

  // 4. indexing
  this.data.forEach(function(row, i){ row.index = i; });

  this.refresh_calc_cell();
  // 5. rendering
  this.render_data(this, 0);
  _adjust_scroll_v(this, this.data.length);
  return this;
};

/**
 * 체크박스/라디오버튼이 있는 col 를 검사하여 체크 표시가 된 row 의 인덱스 넘버를 배열로 리턴한다
 * @param col
 * @returns {Array}
 *
 * ex)
 * Get_checked(0)    : 0 번 컬럼을 검사하여 체크 표시가 된 row 의 인덱스 넘버를 리턴한다
 * Get_checked('pk') : scheme 에서 name 을 pk 로 준 컬럼을 검사하여 체크 표시가 된 row 의 인덱스 넘버를 리턴한다
 */
FGR.prototype.Get_checked = function(column){
  
  const col     = (_.isString(col)) ? _.findIndex(this.scheme, {name: col}) : column;
  const checked = [];
  
  this.data.forEach(function(row, i){
    if(row[col] > 0) checked.push(i);
  });
  
  return checked;
};

/**
 * 컬럼 백그라운드 컬러링
 * 백그라운드 컬러를 투명하게 만들고 싶다면 color 값에 'transparent' 또는 '' 를 주면 된다
 * @param col_index
 * @param color
 * @returns {FGR}
 */
FGR.prototype.col_bg_color = function(col_index, color){
  if ( ! this.scheme[col_index])
    return this;
  this.scheme[col_index].bg_color = color;
  _create_col_style(this, col_index);
  return this;
};

/**
 * 컬럼 리사이징
 * size 를 0 로 주면 해당 컬럼이 사라지는 효과가 난다
 * size 를 음수 값으로 주면 사이즈가 초기값으로 복구된다
 *
 * @param col_index
 * @param size
 * @returns {FGR}
 */
FGR.prototype.col_resize = function(col_index, size){

  // cashing
  if( ! this.left_header_cells)  this.left_header_cells  = this.div.top_corner.find('.' + _style.cell);
  if( ! this.right_header_cells) this.right_header_cells = this.div.col_label.find('.' + _style.cell);

  const fence_col  = this.scheme[this.cfg.fixed_header - 1];
  const last_col   = this.scheme[this.scheme.length    - 1];
  const left_width = fence_col.left + fence_col.width;
  let   right_width= last_col.left  + last_col.width;
  const right_adj  = this.cfg.left_width - left_width;
  const right_rst  = this.cfg.right_width_show + right_adj + 1;

  // 1. 입력받은 size 를 해당 컬럼의 width 에 입력한다
  this.scheme[col_index].width = (size < 0) ? this.scheme[col_index].init_width : size;
  _set_cell_left_array.call(this);

  // 2. left/right 영역의  width 조정
  this.div.left.width(left_width + 2);
  this.div.top_corner.width(left_width);
  this.div.right.width(right_rst);
  this.div.scroll_h.width(right_rst);

  // 3. 만약 right 영역의 width 가 너무 작다면 마지막 컬럼의 width 를 증가시킨다
  if(right_width <= this.div.right.width()){
    last_col.width += (this.div.right.width() - right_width);
    right_width     = (last_col.left + last_col.width);
  }

  // 4. right 내부의 div width 를 조정한다 (col_label, calc_right, data_table)
  for (var i = 0; i < 3; i++)
    this.div[i][1].width(right_width);

  // 5. 수평 scroll 의 사이즈를 조정하고, show/hide 를 판단한다
  this.scroll_bar_h.width( right_width);
  this.div.bot_right.width(right_width);
  const is_scroll_bar_h_show = (this.div.right.width() <= this.div.data_table.width());

  // 6. 위에서 설정한 값들을 토대로 컬럼 리사이징 작업을 수행한다
  this.show_scroll_bar_h(is_scroll_bar_h_show);
  _create_col_style(this, col_index);

  _re_size_header(this, this.left_header_cells);
  _re_size_header(this, this.right_header_cells);
  
  // 7. width 를 0 으로 주면 hide 모드. 재귀적으로 숨김 처리를 수행한다.
  if(size === 0){
    var next;
    this.scheme.forEach(function(col, i){
      if(col.width > 0)
        next = {index: i, width: col.width};
    });
    if(next) this.col_resize(next.index, next.width);  // recursion
  }
  return this;
};

/**
 * 수평 스크롤 바를 보이거나 숨긴다
 * @param show
 * @returns {FGR}
 */
FGR.prototype.show_scroll_bar_h = function(show){
  this.div.scroll_h.closest('tr')[show ? 'show' : 'hide']();
  return this;
};

/**
 * header cell 의 width 사이즈와 left 값을 조정한다.
 * @param cells
 */
function _re_size_header(_this, cells){
  cells.each(function(){
    const v     = $(this);
    const col   = _toInt(v.attr('col'));
    const merge = _toInt(v.attr('col_merge'));
    var width   = 0;

    for (var i = 0; i < merge; i++)
      width += _this.scheme[col + i].width;

    v.css('left', _this.scheme[col].left);
    v.width(width);
  });
  return _this;
};

/**
 * ajax 방식으로 json 데이터를 전송한다.
 * @param url      : 요청을 보낼 url
 * @param callback : 데이터를 받은 서버가 응답을 보내오면 실행할 callback function
 * @param filter   : 데이터를 필터링할 function.
 *
 * filter 펑션의 parameter 는 data_row, data_index 순으로 들어간다
 * filter 펑션이 false 를 리턴하면 해당 row 는 서버로 전송되지 않는다
 *
 * 예) 0 번 컬럼이 checkbox 인 상황에서,
 *    checkbox 에 check 된 row 만 전송할 경우 다음과 같은 filter function 을 작성하면 된다.
 *
 *    -> function(row, i){ return row[0] > 0; }
 *
 * 예2) 7 번 컬럼의 값이 100 이상인 row 만 서버로 전송
 *
 *    -> function(row, i){ return row[7] >= 100; }
 */
FGR.prototype.save_ajax_json = function(url, parameters, callback, filter){

  var send_data = [],
    row, data;

  for(var i = 0; i < this.data.length; ++i){
    if(filter && ! filter(this.data[i], i))
      continue;

    row = {};
    for (var j = 0; j < this.scheme.length; ++j) {
      row[this.scheme[j].name] = this.data[i][j];
    }
    send_data.push(row);
  }

  const params = {
    data  : send_data,
    params: parameters || {}
  };

  data = JSON.stringify(params);

  $.ajax({
    url         : url,
    data        : data,
    dataType    : 'json',
    contentType : 'application/json',
    type        : 'POST',
    async       : true,
    success     : callback || function(){},
  });
};

/**
 * 데이터 조회 기능
 * 서버에 리퀘스트를 보내고, ajax 방식으로 받아온다
 * @param url
 * @param parameters
 * @param callback
 *
 * f.send_ajax_request('readTest.action', {test: 123, test2: 'asdf'}, function(res){alert(res.test);});
 */
FGR.prototype.send_ajax_request = function(url, parameters, callback){

  const params = { 
      params: parameters || {},
  };

  $.ajax({
    url         : url,
    data        : JSON.stringify(params),
    dataType    : 'json',
    contentType : 'application/json',
    type        : 'POST',
    async       : true,
    success     : callback || function(){},
  });
  return this;
};

/**
 * 다음은 사용자 정의 이벤트 부여 펑션들이다.
 * attatch_click_event   : 클릭 이벤트 부여
 * attatch_change_event  : 값 변경 이벤트 부여
 * attatch_focusin_event : 포커스 인 이벤트 부여
 * attatch_focusout_event: 포커스 아웃 이벤트 부여
 * 
 * 이 펑션들을 호출하여 이벤트 콜백 펑션을 입력할 때마다 이벤트 보관 배열에 push 되며,
 * 이벤트가 발생한 이후 등록된 콜백 펑션들이 순차적으로 호출된다.
 * 
 * 각각의 이벤트 별 콜백 펑션이 보관되는 배열의 이름은 다음과 같다.
 * 
 * this.click_event
 * this.change_event
 * this.focusin_event
 * this.focusout_event
 * 
 * 다음과 같이 두 개의 콜백 펑션을 입력해 주면,
 * 셀을 click 했을 때 A_function 이 호출되고, 뒤이어 B_function 이 호출된다.
 * attatch_click_event( A_function );
 * attatch_click_event( B_function );
 * 
 * 배열을 돌며 펑션을 호출하므로, 만약 특정 이벤트의 발생을 중단하려면
 * 이벤트 보관 배열에서 해당 펑션을 제거하면 된다.
 * 
 * 또한, 특정 이벤트를 일시 중지하려면 this.event_flag 의 설정을 변경해주면 된다.
 * 다음은 this.event_flag 의 기본 설정이다.
 * this.event_flag = { click: true, change: true, focusin: true, focusout: true};
 * 
 * 콜백 펑션의 사용 예)
 * attatch_click_event( function(e, row, col, val, _this){} );
 * attatch_change_event( function(e, row, col, val, before, _this){} );
 * attatch_focusin_event( function(e, row, col, val, _this){} );
 * attatch_focusout_event( function(e, row, col, val, _this){} );
 *
 * ※ callback 펑션의 parameter 는 다음과 같다.
 * e     : 이벤트 객체
 * row   : 이벤트가 발생한 cell 의 row
 * col   : 이벤트가 발생한 cell 의 col
 * val   : 이벤트가 발생한 cell 의 data
 * before: (change 이벤트에서만 사용) change 이벤트 발생 이전의 data
 * _this : FGR 객체
 */
function _attatch_evt(event_arr, event_func){
  if(_.isFunction(event_func)){
    event_arr.push(event_func);
    return true;
  }
  return false;
};
FGR.prototype.attatch_click_event    = function(event_func){ return _attatch_evt(this.click_event,    event_func); };
FGR.prototype.attatch_change_event   = function(event_func){ return _attatch_evt(this.change_event,   event_func); };
FGR.prototype.attatch_focusin_event  = function(event_func){ return _attatch_evt(this.focusin_event,  event_func); };
FGR.prototype.attatch_focusout_event = function(event_func){ return _attatch_evt(this.focusout_event, event_func); };

/**
 * grid data 를 초기값으로 되돌린다
 */
FGR.prototype.clear = function(){
  this.data = this.create_init_data();
  this.data.forEach(function(row, i){ row.index = i; });  // indexing
  this.refresh();
  return this;
};

/**
 * header cell 에 resize 기능을 입력한다
 * @dependent_on jquery-ui
 * @special_thanks : 이영서
 */
function _create_resizer() {

  const _this       = this;
  const resizer_css = {
    position : 'absolute',
    right    : 0,
    'z-index': 0,  // datepicker 의 z-index 가 1 이기 때문에 달력 위로 나타날 가능성을 제거해 준다
  };

  function stop_func (e, ui) {
    _this.col_resize(0, _this.scheme[0].width);
  }

  function resize_func (e, ui) {
    const col = _toInt($(this).attr('col'));
    _this.col_resize(col, ui.size.width);

    if(_this.get_gen_col() >= 0) _this.refresh();
  }
  
  this.scheme.forEach((column, i) => {
    
    if( ! column.resize) return true;

    const cfg     = column.resize;
    const div     = (i < this.cfg.fixed_header) ? this.div.top_corner : this.div.col_label;
    const header  = div.find(`div[col=${i}]`).last();
    const options = {
        maxHeight: header.height(),
        minHeight: header.height(),
        maxWidth : cfg.max || undefined,
        minWidth : cfg.min || 20,
        handles  : 'se',
        stop     : stop_func,
        resize   : resize_func,
    };
    
    resizer_css.top = header.height() - this.cfg.resize_icon_size;

    // resizable function 이 존재한다면 resize 아이콘을 생성한다
    if(header.resizable) header.resizable(options);

    header.css('position', 'absolute');
    this.resize_btn[i] = header.find('.ui-resizable-handle')
      .attr('title', _msg.header_resize)
      .css(resizer_css);
  });
  return this;
};

/**
 * row 스크롤을 담당하는 펑션
 * @param move : 스크롤할 row 의 수
 * @returns {FGR}
 */
FGR.prototype.scroll_row = function(move){
  
  if(! _.isNumber(move) || this.row_selected >= this.data.length)
    return this;
  
  const row_cnt = (() => {
    const cnt = this.current_top_line + move;

    if(cnt < 0) return 0;
    
    const remain_cnt = this.data.length - this.cfg.rows_show;

    return (cnt > remain_cnt) ? remain_cnt : cnt;
  })();

  this.scroll_mode      = false;  // scroll 이벤트 중복 방지
  this.current_top_line = row_cnt;
  this.render_data(this, row_cnt);
  this.div.scroll_v.scrollTop(this.cfg.row_height * row_cnt);  // scroll

  return this;
};

/**
 * 하나의 cell 에 대하여 editable 속성을 정의해 준다
 * 이 펑션을 사용하여 column 의 edit 설정이 false 인 경우에도 editable 하게 변경할 수 있다
 * 
 * 예) grid.set_cell_editable(3,2, true);
 * @param row
 * @param col
 * @param edit
 * @returns {FGR}
 */
FGR.prototype.set_cell_editable = function(row, col, edit){
  if( ! this.data[row].editable)
    this.data[row].editable = {};
  this.data[row].editable[col] = edit;
  return this;
};

/**
 * 해당 셀의 edit 속성을 검사한다
 * @param row
 * @param col
 * @returns
 */
FGR.prototype.is_editable_cell = function(row, col){
  if(col === false)
    return false;
  if(this.data[row] === undefined)
    return true;
  const editable = this.data[row].editable;
  return (editable === undefined || editable[col] === undefined) ? this.scheme[col].edit : editable[col];
};

/**
 * 그리드 전체를 disabled 할 수 있다
 * @param (Boolean) disable : true - 그리드를 사용 불가하게 한다, false - 사용 가능하게 한다
 * @param (Number)  opacity : 0 ~ 1 사이의 숫자를 준다. (0 : 투명, 0.5 : 반투명, 1 : 불투명)
 * @param (String)  color   : grid 를 덮을 색깔을 지정한다. 지정하지 않을 경우 기본 색깔인 #B6B6B6 이 나타난다
 * @param (Number)  z       : z-index 값을 지정해 줄 수 있다
 * @returns {FGR}
 *
 * 예)
 * disable(true)                    : 기본 속성으로 disable cover 를 활성화 한다.
 * disable(false)                   : disable cover 를 비활성화 한다.
 * disable(true, 0.5, 'red')        : disable cover 를 0.5 의 투명도로 활성화한다. 색깔은 빨간색으로 한다.
 * disable(true, 0.5, '#FF0000')    : disable cover 를 0.5 의 투명도로 활성화한다. 색깔은 빨간색으로 한다.
 * disable(true, 0.5, undefined, 30): disable cover 를 0.5 의 투명도로 활성화한다. z-index 는 30 으로 한다.
 */
FGR.prototype.disable = function(disable, opacity, color, z){

  this.div.cover[disable ? 'show' : 'hide']();

  if(_.isNumber(opacity))  this.div.cover.css('opacity', opacity);
  if(color !== undefined) this.div.cover.css('background-color', color);
  if(z     !== undefined) this.div.cover.css('z-index', z);

  return this;
};

/**
 * 개별 row 의 background-color 를 정의한다
 * @param row
 * @param color
 * @returns {FGR}
 */
FGR.prototype.set_row_color = function(row, color){
  if(this.data[row] !== undefined)
    this.data[row].bg_color = color;
  return this;
};

/**
 * column header 에 필터 아이콘을 입력한다
 * @returns {FGR}
 */
function _create_filter_icon(){

  const _this     = this;
  this.div.filter = _create_filter_div.call(this);

  function f_toggle (e){
    if( ! _this.cfg.use_filter_div || _this.div.filter.is(':visible'))
      return _this.div.filter.hide();

    _this.div.filter.slideDown();
  }

  this.scheme.forEach((column, col) => {
    const div    = (col < this.cfg.fixed_header) ? this.div.top_corner : this.div.col_label;
    const header = div.find(`div[col=${col}]`);
    const attr   = { 'class': _style.filter_btn, col};

    if( ! /&checkbox|&radio/.test(column.label))
      header.css('cursor', 'pointer')
        .click(f_toggle);

    // 각 header title 에 filter icon 을 부착한다.
    column.filter_icon = $('<div>', attr).appendTo(header.last());
  });
  return this;
};

/**
 * filter 시 사용할 펑션들
 */
const _filter_functions = {
  // d : 필터링 할 데이터, v : 사용자가 입력한 비교 값

  // string, number filter functions
  equal       : (d,v) => (d === v),
  not_equal   : (d,v) => (d !== v),
  begins_with : (d,v) => String(d).startsWith(v),
  ends_with   : (d,v) => String(d).endsWith(v),
  contains    : (d,v) => (String(d).indexOf(v) >= 0),
  not_contain : (d,v) => (String(d).indexof(v) <  0),

  // number filter functions
  less_than     : (d,v) => (d < v),
  greater_than  : (d,v) => (d > v),
  less_equal    : (d,v) => (d <= v),
  greater_equal : (d,v) => (d >= v),

  // check filter functions
  //is_true_check  : function (d,v){return d !== null && d !== undefined && d > 0;},
  //is_false_check : function (d,v){return d === null || d === undefined || d === 0;}
};

/**
 * filter div 내부에서 사용할 select (column selector) 를 생성한다
 * @param type
 * @returns
 */
function _create_filter_column_select(_this, attribute){

  const selector = $('<select>', attribute);

  _this.scheme.forEach((column, i) => {
    // column 의 width 가 2 이하라면 ( 숨겨진 상태라면 ) 필터링 대상에서 제외한다
    if(column.width > 2){
      const label = column.label
        .replace(/\&checkbox|&radio/g, '')
        .replace(/\|\|/g, ',')
        .replace(/^,|,$/g, '');
      $('<option>', {text: label, value: i, type: column.type}).appendTo(selector);
    }
  });
  return selector;
};

/**
 * filter div 의 상단부 정렬 영역을 생성한다.
 * div 는 다음과 같은 형태로 구성된다.
 * ┌────────┬───────────────┬────────────────┬─────────────┬──────────────┐
 * │ select │ checkbox(asc) │ checkbox(desc) │ plus button │ minus button │
 * └────────┴───────────────┴────────────────┴─────────────┴──────────────┘
 * select   : 적용할 컬럼을 선택한다 - name: {id}_filter_sort_column
 * chk(asc) : 오름차순으로 정렬 옵션 - name: {id}_filter_sort_asc
 * chk(desc): 내림차순으로 정렬 옵션 - name: {id}_filter_sort_desc
 * + button : 조건 추가 버튼
 * - button : 조건 삭제 버튼
 * @returns
 */
function _create_filter_sort_div(_this){

  // 체크박스 클릭 이벤트 펑션
  function click_sort () {
    const $this = $(this);
    if( ! $this.prop('checked')) return;
    $this.closest('div').find('input[type=checkbox]').prop('checked', false);
    $this.prop('checked', true);
  };

  // +, - 버튼 클릭 이벤트 펑션
  function click_plus_minus () {
    const $this      = $(this);
    const parent_div = $this.closest('div');
    if('plus' === $this.attr('func')){
      // + 버튼을 클릭하면 정렬 정보 입력 div 를 추가한다
      const s_div = parent_div.clone(true, true);
      s_div.find('button').css('visibility', '');
      s_div.insertAfter(parent_div);
    } else {
      // - 버튼을 클릭하면 정렬 정보 입력 div 를 제거한다
      parent_div.remove();
    }
  };

  const attr = {
    sort_area  : {'class': _style.filter_sort_div, style: 'padding-left: 78px;'},
    sort_title : {'class': _style.filter_sort_title},
    sort_div   : { },
    s_select   : { 'class': _style.filter_check, type: 'sort', func: 'column',
                   name   : `${_this.get_id()}_filter_sort_column`, },
    sort_asc   : { 'class': _style.filter_check, type:'checkbox', order: 'sort_asc' },
    check_asc  : { 'class': _style.filter_check, type:'checkbox', order: 'sort_asc' },
    check_desc : { 'class': _style.filter_check, type:'checkbox', order: 'sort_dessc' },
    plus_btn   : {'class': _style.filter_plus_btn,  func: 'plus' },
    minus_btn  : {'class': _style.filter_minus_btn, func: 'minus'},
  };

  const sort_area      = $('<div>', attr.sort_area );
    const sort_title   = $('<label>', attr.sort_title);
    const sort_div     = $('<div>', attr.sort_div);
      const s_select   = _create_filter_column_select(_this, attr.s_select);
      const sort_asc   = $('<label>', attr.sort_asc);
        const chk_asc  = $('<input>', attr.check_asc).change(click_sort);
        const msg_asc  = _msg.sort_asc;
      const sort_desc  = $('<label>', attr.check_desc);
        const chk_desc = $('<input>', attr.check_desc).change(click_sort);
        const msg_desc = _msg.sort_desc;
      const plus_btn   = $('<button>', attr.plus_btn).click(click_plus_minus);
      const minus_btn  = $('<button>', attr.minus_btn).click(click_plus_minus).css('visibility', 'hidden');
  
  sort_area.append(sort_title, sort_div);
    sort_div.append(s_select, sort_asc, sort_desc, plus_btn, minus_btn);
    sort_asc.append(chk_asc, msg_asc)
    sort_desc.append(chk_desc, msg_desc);

  if( ! _this.cfg.use_sort_panel) sort_area.hide();

  return sort_area;
};

/**
 * filter div 의 중단부 필터 조건 영역을 생성한다.
 * div 는 다음과 같은 형태로 구성된다.
 * ┌─────────┬─────────┬─────────┬───────┐
 * │ select1 │ select2 │ select3 │ input │
 * └─────────┴─────────┴─────────┴───────┘
 * select1 - name : {id}_filter_cond_operator
 * select2 - name : {id}_filter_cond_column
 * select3 - name : {id}_filter_cond_condition
 * input   - name : {id}_filter_cond_value
 *
 * @returns
 */
function _create_filter_condition_div(_this){

  // +, - 버튼으로 정렬 정보 입력 div 를 추가, 삭제한다
  function click_plus_minus () {
    const $this       = $(this);
    const $parent_div = $this.closest('div');
    if('plus' === $this.attr('func')){
      $parent_div.clone(true, true).insertAfter($parent_div)
        .css('border-top', '1px solid transparent')
        .find('button, select').css('visibility', '');
    } else {
      $parent_div.remove();
    }
  }
  
  // 필터 연산자 변경
  function operator_change () {
    const $this  = $(this);
    const border = ('AND' === $this.val()) ? '1px solid transparent' : '1px solid red';
    $this.closest('div').css('border-top', border);
  }
  
  // 필터 대상 컬럼 변경
  function column_change () {
    const $this       = $(this);
    const condition   = $this.closest('div').find('select[func=condition]');
    const selector    = (() => {
      const type = _this.scheme[$this.val()].type;
      if(type.match(/check|radio/)) return 'check'; 
      if(type === 'number')         return 'number';
      else                          return 'str';
    })();

    if(_this.is_IE()){
      condition.find('option').attr('disabled', true);
      condition.find('option[d_type*=' + selector + ']').attr('disabled', false);
    } else {
      condition.find('option').hide();
      condition.find('option[d_type*=' + selector + ']').show();
    }
  }

  const _id = _this.get_id();

  const div             = $('<div>',    {'class': _style.filter_sort_div});
    const sort_title    = $('<label>',  {'class': _style.filter_filter_title});
    const cond_div      = $('<div>',    {'class': _style.filter_cond});
      const f_operator  = $('<select>', { func: 'operator',  name: `${_id}_filter_cond_operator`}).change(operator_change);
        const opt_and   = $('<option>', {text: 'AND', value: 'AND' });
        const opt_or    = $('<option>', {text: 'OR',  value: 'OR'  });
      const f_column    = _create_filter_column_select(_this, {func: 'column', type: 'cond', name: `${_id}_filter_cond_column`}).change(column_change);
      const f_condition = $('<select>', { func: 'condition', name: `${_id}_filter_cond_condition`});
        //const options
      const f_value     = $('<input>',  { func: 'value',     name: `${_id}_filter_cond_value`});
      const plus_btn    = $('<button>',{'class': _style.filter_plus_btn,  func: 'plus' }).click(click_plus_minus);
      const minus_btn   = $('<button>',{'class': _style.filter_minus_btn, func: 'minus'}).click(click_plus_minus);

  // options of f_condition
  f_condition.append([
    {html: _msg.filter_none, value: 'none',         d_type: 'number,str,check'},
    {html: _msg.filter_eq,   value: 'equal',        d_type: 'number,str'},
    {html: _msg.filter_ne,   value: 'not_equal',    d_type: 'number,str'},

    {html: _msg.filter_lt,   value: 'less_than',    d_type: 'number'},
    {html: _msg.filter_gt,   value: 'greater_than', d_type: 'number'},
    {html: _msg.filter_le,   value: 'less_equal',   d_type: 'number'},
    {html: _msg.filter_ge,   value: 'greater_equal',d_type: 'number'},

    {html: _msg.filter_begin,value: 'begins_with',  d_type: 'number,str'},
    {html: _msg.filter_end,  value: 'ends_with',    d_type: 'number,str'},
    {html: _msg.filter_cont, value: 'contains',     d_type: 'number,str'},
    {html: _msg.filter_ncont,value: 'not_contain',  d_type: 'number,str'}
    //{html: 'True 값 있음', value: 'is_true_check', d_type: 'check'},
    //{html: 'False 값 없음',value: 'is_false_check',d_type: 'check'}
  ].map(  (attr) => $('<option>', attr)  ));

  // assemble
  div.append(sort_title, cond_div);
  cond_div.append(f_operator, f_column, f_condition, f_value, plus_btn, minus_btn);
  f_operator.append( opt_and, opt_or );

  // 후처리
  cond_div.find('select').change();
  div.find('select[func=operator]').eq(0).val('OR').css('visibility', 'hidden');
  div.find('button[func=minus]').eq(0).css('visibility', 'hidden');
  
  if( ! _this.cfg.use_filter_panel) div.hide();

  return div;
};

/**
 * 정렬/필터 panel 의 설정을 되돌린다
 * @returns {FGR}
 */
FGR.prototype.clear_filter_condition = function(_this) {
  const that = _this || this;

  that.div.filter.find('.' + _style.filter_minus_btn).each(function(){
      const $this = $(this);
      if($this.css('visibility') !== 'hidden') $this.click();
  });

  that.div.filter.find('input[type=checkbox]').prop('checked', false);
  
  const filter_div = that.div.filter.find('.' + _style.filter_sort_div);

  filter_div.find('select').each(function(){
    const $this = $(this);
    const value = $this.find('option').first().val();
    $this.val(value).change();
  });
  filter_div.find('input').val('');
  return this;
};

/**
 * filter 설정용 div 를 생성한다
 * @param col
 * @returns
 */
function _create_filter_div(){
  const _this = this;
  const attr  = {
      div   : { 'id': `${this.get_id()}_filter_div`, 'class': _style.filter_div },
      run   : { 'text' : _msg.filter_run,   'class': _style.filter_inner_btn },
      clear : { 'text' : _msg.filter_clear, 'class': _style.filter_inner_btn },
      close : { 'text' : _msg.filter_close, 'class': _style.filter_inner_btn },
  };
  const div          = $('<div>', attr.div);
    const sort_div   = _create_filter_sort_div(this);       // 정렬 설정 입력칸을 생성한다
    const filter_div = _create_filter_condition_div(this);  // 필터 설정 입력칸을생성한다
    const btn_run    = $('<button>', attr.run).click(  () => _this.run_filter(_this)  );
    const btn_clear  = $('<button>', attr.clear).click(  () => _this.clear_filter_condition(_this)  );
    const btn_close  = $('<button>', attr.close).click(  () => div.hide()  );
  
  // assemble
  this.div.main.append(div);
  div.append(sort_div, filter_div, btn_run, btn_clear, btn_close);
  div.draggable({ containment: "parent" });

  return div;
};

/**
 * filter div 에서 '적용' 버튼을 입력하면 호출되는 필터링 펑션
 */
FGR.prototype.run_filter = function(_this){

  const functions = _this.collect_filter_functions(); // 필터링 조건을 참고하여 연산자별 필터링 펑션을 수집한다

  // # target_row 가 필터링 조건에 맞는지 검사하는 펑션
  function is_matched_data (target_row) {
      var d_validate;
      loopJ : for(var j = 0; j < functions.length; ++j){
        d_validate = false;
        var _and;
        loopK : for(var k = 0; k < functions[j].length; ++k){
          var _filter= functions[j][k];
          if(_filter.func === undefined) continue loopK;
          _and = _filter.func(target_row[_filter.col], _filter.value);
          if( ! _and) break loopK;
        }
        if(_and){
          d_validate = true;
          break loopJ;
        }
      }
      return d_validate;
  }; // #

  // ## 필터링된 데이터를 정렬한다
  function sort_filtered_data (_this) {
      const s_div       = _this.div.filter.find('._fg_filter_sort_div');
      const $columns    = s_div.find(`select[name=${_this.get_id()}_filter_sort_column]`);
      const check_asc   = s_div.find('input[order=sort_asc]');
      const check_desc  = s_div.find('input[order=sort_desc]');
      const sort_driver = [];  // 정렬시 이용할 자료의 배열
      
      $columns.each(function(i, column){
        const col         = _toInt($(this).val());
        const order_asc   = check_asc.eq(i).prop('checked');
        const order_desc  = check_desc.eq(i).prop('checked');
        const is_number   = _this.scheme[col].type === 'number';
        const not_checked = !order_asc && !order_desc;

        if(not_checked) return true;  // 선택된 체크박스가 없다면 건너뛴다

        const sort_func = _this.sort_func(col);  // 정렬 function 을 가져온다
        const func      = sort_func[(is_number ? 'number_' : 'str_') + (order_asc ? 'asc' : 'desc')];
        sort_driver.push({ col, func });
      });

      // sort parameter function
      function sort_f (a,b) {
        for(var i = 0; i < sort_driver.length; ++i){
          const col = sort_driver[i].col;
          if(a[col] !== b[col]) return sort_driver[i].func(a,b);
        }
        return 0;
      };

      if(sort_driver.length > 0){
        // 정렬 조건이 입력된 상태라면 조건에 따라 정렬을 한다
        _this.data.sort(sort_f);
        _this.sorted = true;
      } else if (_this.sorted){
        // 정렬 조건이 입력되지 않았는데, 정렬된 상태라면 정렬을 revert 한다.
        _this.data.sort( _this.sort_func(0).revert );
        _this.sorted = false;
      } else {
        // 정렬 조건이 입력되지 않았고, 정렬된 상태가 아니라면 정렬하지 않는다.
      }
  }; // ##

  // 1. 필터 작업
  if( ! _this.validate_filter_options()) return alert('잘못된 입력입니다');

  _this.div.filter.hide(); // filter 설정창을 닫는다

  if(_this.pre_filter_data) _this.data = _this.pre_filter_data;

  // 필터링 복원을 위해 기존의 data array 를 pre_filter_data 에 보관한다
  _this.pre_filter_data = _this.data;

  var post_filter_data = []; // 필터링 결과를 담을 배열을 선언한다
  // 필터링 작업을 수행한다
  if(functions.length > 0){
    post_filter_data = _this.data.filter(is_matched_data);
    _this.filtered   = true;
  } else {
    post_filter_data = _this.data;
    _this.filtered   = false;
  }
  _this.data = post_filter_data;

  // 2. 정렬 작업
  sort_filtered_data(_this);
  _this.refresh_calc_cell();

  // 3. 화면 렌더링 -----------------------------------------------------
  // 공백 row 처리
  if(_this.data.length < _this.rows.length){
    const last       = _this.rows.length - _this.data.length;
    const empty_rows = _this.create_init_data(last);
    _this.data = _this.data.concat(empty_rows);
  }

  _this.scroll_row(-_this.data.length * 2);          // 스크롤을 가장 위로 올린다
  _this.render_data(_this, _this.current_top_line);  // 데이터를 보여준다
  _this.scroll_v_inner.height(_this.data.length * _this.cfg.row_height);

  // 필터링 된 컬럼의 깔대기 아이콘의 색깔을 바꿔준다
  _this.scheme.forEach(function(col){
    col.filter_icon.attr('class', _style.filter_btn);
  });
  
  for(var i = 0; i < functions.length; ++i){
    for(var j = 0; j < functions[i].length; ++j){
      const filtered_column = (functions[i][j].col);
      _this.scheme[filtered_column].filter_icon.attr('class', _style.filter_btn_red);
    }
  }
  return;
};

/**
 * 필터링 옵션을 검사한다
 */
FGR.prototype.validate_filter_options = function(){
  const _id = this.get_id();
  const col  = this.div.filter.find(`select[name=${_id}_filter_cond_column]`);
  const val  = this.div.filter.find(`input[name=${_id}_filter_cond_value]`);

  for(var i = 0; i < col.length; ++i){
    const column     = col.eq(i).val();
    const type       = this.scheme[column].type;
    const number_str = _is_number_str(val.eq(i).val());
    
    if(type === 'number' && ! number_str){
      val.eq(i).focus();
      return false;
    }
  }
  return true;
};

/**
 * filter 작업시 사용할 function 을 수집한다
 */
FGR.prototype.collect_filter_functions = function(){

  const _id       = this.get_id();
  const div       = this.div.filter;
  const op        = div.find(`select[name=${_id}_filter_cond_operator]`);
  const col       = div.find(`select[name=${_id}_filter_cond_column]`);
  const cond      = div.find(`select[name=${_id}_filter_cond_condition]`);
  const val       = div.find(`input[name=${_id}_filter_cond_value]`);
  const functions = [];

  _.range(op.length).forEach( (i) => {
      const is_empty_value = /^\s*$/.test(val.eq(i).val());

      if(is_empty_value) return;

      // OR operation 이라면 새로운 array 를 추가하고
      // AND operation 이라면 기존의 마지막 array 에 추가한다. (단, 마지막 array 가 존재하지 않는다면 새로운 array 를 추가한다.
      const and_array = ('OR' === op.eq(i).val()) ? [] : (functions.pop() || []);
      const f_name    = cond.eq(i).val();
      const f_data    = {
          col  : _toInt(col.eq(i).val()),
          func : _filter_functions[f_name],
          value: val.eq(i).val(),
      };
      if(this.scheme[f_data.col].type === 'number'){
        if(_is_number_str(f_data.value))
          f_data.value = Number(f_data.value);
      }
      and_array.push(f_data);
      functions.push(and_array);
  });
  return functions;
};

/**
 * data 필터링 작업을 수행한다.
 * 
 * @param is_matched_data : filter 펑션
 * @param target_column   : 필터링 작업이 끝난 후, 필터 아이콘을 표시할 컬럼 넘버의 배열
 * @returns {FGR}
 * 
 * 예)
 * grid.data_filter(function( row ){ return row[4] > 5000;  }, [4]);     // 4 번 컬럼의 값이 5000 초과인 행을 필터링한다. 이후 4번 컬럼에 필터 아이콘을 표시한다.
 * grid.data_filter(undefined, []);                                      // 필터링을 원상태로 복구하고, 필터 아이콘을 전부 숨긴다.
 */
FGR.prototype.data_filter = function(is_matched_data, target_column){

  const _this = this;

  // 이미 사전에 필터링 되어 있는 상태라면 필터링 상태를 복원한다.
  if(_this.pre_filter_data) _this.data = _this.pre_filter_data;

  // 필터링 복원을 위해 기존의 data array 를 pre_filter_data 에 보관한다
  _this.pre_filter_data = _this.data;
  
  // 필터링 작업을 수행한다
  const do_filter = _.isFunction(is_matched_data);

  // 필터링 결과를 담을 배열을 선언한다. 추후 이 배열이 this.data 에 입력된다.
  _this.data = do_filter ? _this.data.filter(is_matched_data) : _this.data;

  // 필터링 된 상태인지를 표시한다.
  _this.filtered = do_filter;

  // calc_row 를 갱신한다.
  _this.refresh_calc_cell();

  // 공백 row 처리
  if(_this.data.length < _this.rows.length){
    const empty_rows = _this.create_init_data(_this.rows.length - _this.data.length);
    _this.data       = _this.data.concat(empty_rows);
  }

  _this.scroll_row(-_this.data.length * 2);          // 스크롤을 가장 위로 올린다
  _this.render_data(_this, _this.current_top_line);  // 데이터를 보여준다

  // 스크롤 바 사이즈를 조절한다
  _this.scroll_v_inner.height(_this.data.length * _this.cfg.row_height);

  // 필터링 된 컬럼의 깔대기 아이콘의 색깔을 바꿔준다
  _this.scheme.forEach(function(col){
    col.filter_icon.attr('class', _style.filter_btn);
  });
  
  target_column.forEach( (column) => {
    _this.scheme[column].filter_icon.attr('class', _style.filter_btn_red);
  });
  return this;
};

/**
 * 검색창을 생성한다.
 */ 
function _create_search_div(){

  function create_table(blue_print){
      const $table = $('<table>');
      for(var i in blue_print){
        const tr = $('<tr>').appendTo($table);
        for(var j in blue_print[i])
          $('<td>').appendTo(tr).append(blue_print[i][j]);
      }
      return $table;
  }

  const _this = this;
  const _id   = this.get_id();
  const div   = $('<div>', {'class': _style.search_div, align: 'right'});
  const column_select = _create_filter_column_select(this, {id: `${_id}_search_column_range`});

  this.div.search = div.appendTo(this.div.main).draggable({ containment: "parent" });
  column_select.find('option[type=radio], option[type=check]').remove();
  column_select.prepend($('<option>', {html: '전체', value: 'all'}));

  // 검색 fieldset
  const b_print = {
    column  : { title: $('<label>', {html: _msg.target}),   obj: column_select},
    search  : { title: $('<label>', {html: _msg.do_search}),obj: $('<input>') },
    replace : { title: $('<label>', {html: 'replace'}),     obj: $('<input>') },
  };

  // 방향 fieldset
  const d_print = {
    direction : {
      f_obj   : $('<input>', {type: 'radio', name : `${_id}_search_dir`, id: `${_id}_search_f_dir`, checked: true}), 
      f_title : $('<label>', {html: _msg.forward,'for': `${_id}_search_f_dir`}), 
      b_obj   : $('<input>', {type: 'radio', name : `${_id}_search_dir`, id: `${_id}_search_b_dir`}), 
      b_title : $('<label>', {html: _msg.reward, 'for': `${_id}_search_b_dir`}),
    }
  };

  // 옵션 fieldset
  const options = {
    case_ignore : {  // 대소문자 무시
      obj   : $('<input>', {type: 'checkbox',     'id' :`${_id}_search_case_ignore`}),
      title : $('<label>', {html: _msg.ig_case,   'for':`${_id}_search_case_ignore`}) },
    whole_word  : {  // 일치하는 단어만 검색
      obj   : $('<input>', {type: 'checkbox',     'id' :`${_id}_search_whole_word`}),
      title : $('<label>', {html: _msg.whole_word,'for':`${_id}_search_whole_word`}) },
    wild_card   : {  // 와일드 카드 사용
      obj   : $('<input>', {type:'checkbox',      'id' :`${_id}_search_wild_card`}),
      title : $('<label>', {html: _msg.wild_card, 'for':`${_id}_search_wild_card`}) },
    reg_exp     : {  // 정규 표현식 사용
      obj :   $('<input>', {type:'checkbox',      'id' :`${_id}_search_regular_expression`}),
      title : $('<label>', {html: _msg.reg_exp,   'for':`${_id}_search_regular_expression`}) }
  };

  const field1   = $('<fieldset>', {align: 'left'});
  const field2   = $('<fieldset>', {align: 'left'});
  const field3   = $('<fieldset>', {align: 'left'});
  const title    = $('<legend>', {html: _msg.search   });
  const title2   = $('<legend>', {html: _msg.direction});
  const title3   = $('<legend>', {html: _msg.option   });
  const find_btn = $('<button>', {html: _msg.find_btn   });
  const repl_btn = $('<button>', {html: _msg.replace_btn});
  const close_btn= $('<button>', {html: _msg.close_btn  });

  // 조립
  div.append([field1, field2, field3, find_btn, repl_btn, close_btn]);
  field1.append([title,  create_table(b_print)]);
  field2.append([title2, create_table(d_print)]);
  field3.append([title3, create_table(options)]);

  // show, hide 처리
 ;[b_print.replace.obj, b_print.replace.title, repl_btn].forEach( (obj) => obj[this.cfg.search_replace ? 'show':'hide']() );
 ;[options.reg_exp.obj, options.reg_exp.title].forEach( (obj) => obj[this.cfg.search_by_reg_exp ? 'show':'hide']() );

  // 이벤트 처리
  column_select.keydown(function(e){
    if(e.keyCode === 9 && e.shiftKey){  // <S-Tab>
      close_btn.focus();
      e.preventDefault();
    } });

  b_print.search.obj.keydown(function(e){
    if(e.keyCode === 13)  // <ENTER>
      find_btn.click();
  });

  // regular_expression 옵션이 켜지면 whole_word, wild_card 옵션은 disabled 상태로 바뀐다.
  options.reg_exp.obj.click(function(e){
    const op      = options;
    const flag    = $(this).prop('checked');
    const disable = (obj, flag) => { obj.attr('disabled', flag).css('opacity', flag ? 0.3 : 1) };
    [].concat( _.values(op.whole_word), _.values(op.wild_card) ).forEach( (o) => disable(o, flag) );
  });

  // close 버튼 
  close_btn.click(function(e){ div.hide(); })
    .keydown(function(e){
      if(e.keyCode === 9 && !e.shiftKey){
        column_select.focus();
        e.preventDefault();
      } });

  // 검색 버튼
  find_btn.click(function(e){

    const direction  = d_print.direction.f_obj.prop('checked') ? 1 : -1;
    const whole_word = options.whole_word.obj.prop('checked');
    const ignore_case= options.case_ignore.obj.prop('checked');
    const wild_card  = options.wild_card.obj.prop('checked');
    const reg_exp    = options.reg_exp.obj.prop('checked');
    const query      = b_print.search.obj.val();
    const range      = column_select.val();
    const start_col = (range === 'all') ? 0 : _toInt(range);
    const end_col   = (range === 'all') ? _this.scheme.length : _toInt(range) + 1;
    // ※ is_match 펑션의 두 파라미터는 다음과 같다. d : 필터링 할 데이터, v : 사용자가 입력한 비교 값
    const is_match  = _this.create_search_reg_exp (query, reg_exp, whole_word, ignore_case, wild_card);
    const start_row = _this.row_selected + direction;
    const query_arr = [];  // query_arr, query_reg : select 타입인 경우 실제 데이터 값과 표시되는 값이 다르기 때문에
    const query_reg = [];  // 실제 데이터 값(text)과 비교하지 않고, text 값과 비교해야 한다. 따라서 검색의 기준이 되는 query 배열을 마련한다.

    // 검색 query 수집: 검색 속도를 위해 각 컬럼(타입)별로 정규식을 생성한다.
    _this.scheme.forEach(function(column, i){
      query_reg[i] = /$^/;

      if(column.type === 'select'){
        // select type 인 경우 option 을 검색해야 한다.
        loopK : for(var k = 0; k < column.option.length; ++k){
          if(is_match.test(column.option[k].text)){
            query_arr[i] = column.option[k].value; 
            query_reg[i] = this.create_search_reg_exp(query_arr[i], false, true, false, false);
            break loopK; 
          }
        }
      } else if(column.type === 'number'){
        query_arr[i] = query;
        query_reg[i] = this.create_search_reg_exp(query_arr[i], reg_exp, whole_word, ignore_case, wild_card);
      } else if(column.type.match(/check|radio/)){    // check, radio 는 검색하지 않는다
        query_arr[i] = 'not';
        query_reg[i] = /$^/;
      } else {
        query_arr[i] = query;
        query_reg[i] = this.create_search_reg_exp(query_arr[i], reg_exp, whole_word, ignore_case, wild_card);
      }
    }, _this);

    // 검색 ---------------------------------------------------------------------
    var success   = false;
    var cell;
    const set_focus = function set_focus () { 
        if(!cell) return;
        cell.closest('.' + _style.row).mousedown();
        cell.click().focus(); 
    };

    // 커서가 있는 라인부터 검색한다.
    loopI : for(var i = start_row, cnt = 0; cnt < _this.data.length; i+=direction, ++cnt){

      if(i >= _this.data.length)
        i -= _this.data.length;
      else if( i < 0 )
        i = _this.data.length - 1;

      for(var j = start_col; j < end_col; ++j){
        const v = _this.data[i][j];

        if(query_reg[j].test(v)){
          _this.scroll_row(-_this.data.length * 2).scroll_row(i);
          success = true;
          cell    = _this.cell[ i - _this.current_top_line][j];
          setTimeout(set_focus, 100);
          break loopI;
        }
      }
    } // enf of loopI

    if( ! success) alert(_msg.search_fail);
  });
  return this;
};

/**
 * 검색에 사용할 정규 표현식을 동적으로 생성한다
 * @param query
 * @param reg_exp
 * @param whole_word
 * @param ignore_case
 * @param wild_card
 * @returns
 */
FGR.prototype.create_search_reg_exp = function (query, reg_exp, whole_word, ignore_case, wild_card){

  if(query === undefined || query === null) return /$^/;

  // 정규식 옵션이 있다면 사용자가 입력한 정규식을 그대로 사용한다
  if(reg_exp) return new RegExp(exp, ignore_case ? 'i' : undefined);

  // 정규식 옵션이 없다면 사용자의 query 를 바탕으로 정규식을 생성한다
  var exp = query;

  // 1. 공백을 \s 로 치환한다
  exp = exp.replace(/\s/g, '\\s');

  // 2. 사용자가 입력한 특수문자 앞에 \ 를 붙여준다. 예) ? -> \?
  exp = exp.replace(/([\!\@\#\$\%\^\&\*\(\)\-\_\=\+\[\{\]\}\`\~\;\:\'\"\,<\.\>\/\?\\\|])/g, '\\$1');

  // 3. 와일드 카드를 사용한다면, \? 를 . 으로, \* 를 .* 로 치환한다.
  if(wild_card){
    exp = exp.replace(/\\\?/g, '.' );
    exp = exp.replace(/\\\*/g, '.*');
  }

  // 4. 일치 검색이라면 ^ $ 를 정규 표현식의 앞뒤에 붙여준다.
  if(whole_word) exp = '^' + exp + '$';

  // 5. 정규식을 생성한다. ignore_case 옵션이 있다면 i 를 추가한다
  return new RegExp(exp, ignore_case ? 'i' : undefined);
};

/**
 * 메시지 출력용 모달을 제어한다. 사용법은 다음과 같다.
 * 
 * 예) var md = grid.modal('로딩중입니다', false);  // 로딩중임을 표현하고, 확인(닫기) 버튼은 나타나지 않는다.
 * 
 * md.button(false); // 확인 버튼을 숨긴다.
 * md.hide();        // 메시지 출력을 중지한다.
 * md.show(true);    // 메시지를 출력한다. true 옵션을 주면 grid cover 가 활성화된다.
 * md.text('saved'); // 메시지를 변경한다.
 * md.obj            // jQuery wrapped div 객체
 * 
 * @param text
 * @param button
 * @returns {___anonymous125732_126157}
 */
FGR.prototype.modal = function(text, button){

  const _this  = this;
  const modal  = this.div.modal;
  const body   = modal.find('div[role=body]');
  const cont   = modal.find('div[role=control]');
  const disable= (d) => { if(_.isBoolean(d)) _this.disable(d); };
  const func   = {
      obj : modal,
      show (d) { modal.show(); disable(d); },
      hide (d) { modal.hide(); disable(d); },
      text (m) { body.empty().append(m);   },
      button (v) { cont[v ? 'show' : 'hide'](); },
  };

  func.text(text);
  func.button(button);
  return func;
};

/**
 * 범용 모달을 생성한다
 * @returns {FGR}
 */
function _create_modal_div(){
  const  _this   = this;
  const div_attr = {'class': _style.modal_div, align: 'center'};
  const div      = $('<div>', div_attr).appendTo(this.div.main);
  const title    = $('<div>', {html: '', role: 'title', 'class': _style.modal_content});
  const body     = $('<div>', {html: '', role: 'body',  'class': _style.modal_content});
  const control  = $('<div>', {role: 'control', align: 'center', 'class': _style.modal_content});
  const okay_btn = $('<button>', {text: _msg.confirm});
  this.div.modal = div;

  div.position({my: 'center', at : 'center', of: this.div.main});
  div.append([title, body, control]);
  control.append(okay_btn);
  okay_btn.css({position: 'relative', right: 0}).click(() => { div.hide(); _this.disable(false);});

  title.hide();
  control.hide();
  return this;
};

// TODO : 빅 넘버 타입 추가할 것
// TODO : 평균, 합계에 format 입력할 것
// TODO : 필터 기능 적용시 체크박스와 라디오버튼 조건으로 true/false 선택하게 할 것.
// TODO : calc column 추가하고, 중간 sum 기능 추가할 것
// TODO : hide_empty_rows 옵션을 추가할 것.

/**
 * 값이 바뀐 row 를 배열로 리턴한다
 */
FGR.prototype.get_modified_rows = function(){
  return this.data.filter((row) => row.modified );
};

return FGR; })(jQuery);  // end of codes
