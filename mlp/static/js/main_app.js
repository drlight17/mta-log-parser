// append path_prefix to the base_url if any is set
const path_prefix = document.currentScript.getAttribute('path_prefix');
const base_url = path_prefix + '/api/emails';
const base_url2 = path_prefix + '/api/auth';
const base_url3 = path_prefix + '/api/stats';
const base_url4 = path_prefix + '/api/process_check';
// get datetime_format from .env
var datetime_format = document.currentScript.getAttribute('datetime_format');
if (datetime_format == '') {
        datetime_format = 'YYYY-MM-DDTHH:mm:ss.sssZ';
}
// get mail_domain from .env
var mail_domain = document.currentScript.getAttribute('mail_domain');

// get current mlp version
var parser_version = document.currentScript.getAttribute('parser_version');

// get current login
const login = document.currentScript.getAttribute('login');

// get HOUSEKEEPING_DAYS from .env
var housekeeping_days = document.currentScript.getAttribute('housekeeping_days');
if (housekeeping_days == '') {
        housekeeping_days = 0;
}

// get locale langs
var lang_files = JSON.parse(document.currentScript.getAttribute('lang_files'));

//var notie_message_code = document.currentScript.getAttribute('notie_message_code');
var notie_message = document.currentScript.getAttribute('notie_message');

// get args if any
var sent_args = document.currentScript.getAttribute('args');

const app = Vue.createApp({
    // to work with both quart and vue variables on the template pages
    delimiters: ['[[', ']]'],
    data() {
        return {
            localeData: [],
            fallbackLocaleData: [],
            locales: lang_files,
            loading: true,
            //hidden_settips: true,
            hidden_stats: true,
            error: null,
            emails: [],
            search: "",
            search_error: false,
            search_by: "id",
            status_filter: "NOFILTER",
            date_filter__gt: "",
            date_filter__lt: "",
            page: 1,
            page_count: 1,
            page_reset: false,
            order: "timestamp",
            order_dir: "desc",
            count: 0,
            msg: [],
            index: 0,
            msg_length: 0,
            settings: [],
            login: login,
            accounts: [],
            acc: [],
            edit_type: '',
            path_page: 0,
            loaded_settings: false,
            timer:'',
            contdown_sec: 0,
            contdown: '',
            contdown_timer: 0,
            vertical_menu: false,
            filters_changed: false,
            isEqual: true,
            swiped: false,
            is_mobile: false,
            processing: false
        }
    },
    computed: {
        email_filter() {
            let d = {};

            if (this.search !== "") {
                d[this.search_by] = this.search;
            }
            if (this.status_filter !== "NOFILTER") {
                d['status.code'] = this.status_filter;
            }
            if (this.date_filter__gt !== "") {
                d['timestamp__gt'] = this.date_filter__gt;
            }
            if (this.date_filter__lt !== "") {
                d['timestamp__lt'] = this.date_filter__lt;
            }

            return d;
        },
        isDisabled() {
            return (
                 (this.search_by!== "id" || this.search.length > 0 || this.status_filter !== "NOFILTER" || this.date_filter__gt.length > 0 || this.date_filter__lt.length > 0) && !this.search_error
                )
        },
        has_error() {
            return (
                (typeof this.error) !== 'undefined' &&
                this.error !== '' &&
                this.error !== null &&
                this.error !== false
            ) 
        }/*,
        email() {
            return this.modelValue
        }*/
    },
    watch: {
        // equal value watch
        isEqual: {
         handler(val){
           if (this.settings.filters) {
                    this.saveFilters();
                }
           this.filters_changed = true;
         },
         deep: true
        },
        search(val) {

            // text input validation
            if (val.match(/[()\\/$?+\[\]]/)) {
                if (this.localeData.notie.one == undefined) {
                    text = this.fallbackLocaleData.notie.one
                } else {
                    text = this.localeData.notie.one
                }
                notie.alert({type: 'error', text: text+val+'»</b>'});
                $('#text_search').focus();
                $('#text_search').css('color','red');
                this.search_error = true;
            } else {
                if (this.settings.dark) {
                    $('#text_search').css('color', 'white');
                } else {
                    $('#text_search').css('color', 'initial');
                }
                if (this.settings.filters) {
                    this.saveFilters();
                    
                } else {
                    $('#default_period_div').show();
                }
                this.filters_changed = true;
                this.search_error = false;

            }
        },
        search_by(val) {
            if (this.localeData.notie.twenty_six == undefined) {
                    text = this.fallbackLocaleData.notie.twenty_six
            } else {
                text = this.localeData.notie.twenty_six
            }
            if (val == 'log_lines' ) {
                notie.alert({type: 'warning', text: text, time: 6});
            }
            if (this.search !== "") {
                if (this.settings.filters) {
                    this.saveFilters();
                } else {
                    $('#default_period_div').show();
                }
                this.filters_changed = true;
                this.reset_page();
            }
        },
        status_filter(val) {
            if (this.settings.filters) {
                this.saveFilters();
            }
            this.filters_changed = true;
            this.reset_page();
            this.debounce_emails(true);
        },
        date_filter__gt(val) {
            // check if empty
            if (val == '' ) {
                this.check_date_lt();
            }
            this.saveFilters();
            this.filters_changed = true;

            // do not debounce on datestart change
            //this.debounce_emails(true);
        },
        date_filter__lt(val) {
            if (this.settings.filters) {
                this.saveFilters();
            }
            this.filters_changed = true;
            this.reset_page();
            this.debounce_emails(true);
        },
        page(val) {
            //save current page
            this.saveCurPage();
            if (this.page_reset) return;
            this.debounce_emails(true);
        },
        loaded_settings(newVal, oldVal) {
            if (oldVal === false && newVal === true) {
                this.debounce_emails();
            }
        }
    },
    methods: {
        debounce_emails: _.debounce(function(refresh) {
           this.loadEmails(refresh);
        }, 400),
        submitForm(action) {
            $(this.$refs.act_type).attr('value', action);
            if (action == 'delete') {
                window.app.validation(true);
            }

        },
        onResize() {

            if (window.matchMedia('(max-width: 767px)').matches) {
                this.is_mobile = true;
                // force blur turn off on mobile devices
                this.settings.blurring = false;
            } else {
                this.is_mobile = false;
            }
        },
        check_button() {
            if (this.isDisabled) {
                this.debounce_emails(true);
            }
        },
        check_date_lt () {
            if (this.path_page == 2) {
                if (window.app.settings.filters) {
                    if (window.app.date_filter__gt == '') {
                        if (this.localeData.notie.twenty_two == undefined) {
                            text = this.fallbackLocaleData.notie.twenty_two
                        } else {
                            text = this.localeData.notie.twenty_two
                        }
                        notie.alert({type: 'warning', text: text, time: 10});
                    }
                }
            }
        },
        // table to excel export
        ExportToExcel(type, fn, dl) {
           var elt = document.getElementById('emails-list');
           var wb = XLSX.utils.table_to_book(elt, { sheet: "sheet1" });
           cur_date = new Date(Date.now());
           cur_date = this.format_date(cur_date,datetime_format,true);
           return dl ?
             XLSX.write(wb, { bookType: type, bookSST: true, type: 'base64' }):
             XLSX.writeFile(wb, fn || ('exported-data_' + cur_date + '.' + (type || 'xlsx')));
        },
        arrowKeyUnBind() {
            document.onkeydown = null;
        },
        // bind arrow keys for modal arrow buttons
        arrowKeyBind(modal) {
            document.onkeydown = function(e) {
                //console.log(e.which)
                switch(e.which) {
                    case 33: //page up
                    break;

                    case 34: //page down
                    break;

                    case 38: // up
                    $(modal).find('.scrolling.content')[0].scrollBy({top: -200, behavior: "smooth"});
                    break;

                    case 40: // down
                    $(modal).find('.scrolling.content')[0].scrollBy({top: 200, behavior: "smooth"})
                    break;

                    case 37: case 36:// left and home
                    if (window.app.index <= 0) {
                        $('.prev_email').blur();
                    } else {
                        $('.prev_email').focus();
                    }
                    break;

                    case 39: case 35:// right and end
                    if (window.app.index >= window.app.msg_length-1) {
                        $('.next_email').blur();
                    } else {
                        $('.next_email').focus();
                    }
                    break;
                    default: return; // exit this handler for other keys
                }
                e.preventDefault(); // prevent the default action (scroll / move caret)

            };
        },
        // bind swipe moves for modal left and right actions
        swipeBind(modal) {
            if (!(this.swiped)) {
                modal.addEventListener('touchstart', e => {
                  touchstartX = e.changedTouches[0].screenX
                  touchstartY = e.changedTouches[0].screenY
                }/*,
                    {passive: false}*/
                )


                modal.addEventListener('touchend', e => {

                  touchendX = e.changedTouches[0].screenX
                  touchendY = e.changedTouches[0].screenY
                  window.app.checkDirection(e);
                },
                    {
                        /*passive: false,
                        once:true*/
                    }

                )
            }

            /*modal.addEventListener('touchmove', e => {
                e.preventDefault();
                e.stopPropagation();
            })*/
            //modal.addEventListener('touchmove', pageswiping.touchmove, {passive: false});

        },
        // detect swipe direction
        checkDirection(e) {
          //if (e.target.className !== "log_lines") {
            if ((Math.abs(touchstartY - touchendY) < 40) && (e.target.scrollWidth <= e.target.clientWidth)/* && (e.target.parentElement.className !== "log_lines")*/) {
                // check if element under cursor is scrollable
                if ($(e.target.parentElement).outerWidth() - $(e.target.parentElement).get(0).scrollWidth > -1 ) {
                    if (touchendX < touchstartX) {
                        if (window.app.index >= window.app.msg_length-1) {
                            $('.next_email').blur();
                        } else {
                            $('.next_email').focus();
                            //console.log($('#mail-modal i.angle.right.icon:not(.double)'))
                            $('#mail-modal i.angle.right.icon:not(.double)').focus().click();
                            this.swiped = true;
                        }
                    }
                    if (touchendX > touchstartX) {
                        if (window.app.index <= 0) {
                            $('.prev_email').blur();
                        } else {
                            $('.prev_email').focus();
                            //console.log($('#mail-modal i.angle.left.icon:not(.double)'))
                            $('#mail-modal i.angle.left.icon:not(.double)').focus().click();
                            this.swiped = true;
                        }
                    }
                }
            } else {
                return 0;
            }

          //}
        },
        async loadLocaleMessages () {
            const app = this;

            if ('fallbackLocaleData' in window.localStorage) {
                this.fallbackLocaleData = JSON.parse(window.localStorage['fallbackLocaleData']);
            } else {
                await $.getJSON(path_prefix + "/static/locales/en.json")
                    .done(function(json_data_fallback) {
                    window.localStorage.setItem("fallbackLocaleData", JSON.stringify(json_data_fallback));
                    })
                    // set fallback if no locales could be fetched
                    .fail(function(json_data_fallback) {
                        text = "Error! No locales were loaded (maybe locales directory is empty)! Check console log for details and fix all errors!";
                        notie.alert({type: 'error', text: text, stay: true});
                        $("#login").append('<button onClick="window.location.reload();" class="ui button primary refresh-button"><i class="sync icon"></i> Reload page</button>');
                        $(".logo").hide();
                        $('#user-settings').hide();
                        //document.write("Error! No locales weren't loaded (maybe locales directory is empty)! Check console log for details and fix all errors!");
                        app.toggleLoading(false);
                    })
            }
            
            if ('localeData' in window.localStorage) {
                this.localeData = JSON.parse(window.localStorage['localeData']);
            } else {
                await $.getJSON(path_prefix + "/static/locales/"+this.settings.locale+".json")
                    .done(function(json_data) {
                        window.localStorage.setItem("localeData", JSON.stringify(json_data));
                        $(".logo").hide();
                        $('#user-settings').hide();
                        //setTimeout(() => location.reload(), 1000);
                        location.reload();
                    })
                    // set fallback en locale if no current browser locale is supported
                    .fail(function(json_data) {                        
                        window.localStorage.setItem("localeData", window.localStorage['fallbackLocaleData']);
                        window.localStorage.setItem("locale", "en");
                        window.localStorage.setItem("falled_back", true);
                        $(".logo").hide();
                        $('#user-settings').hide();
                        //setTimeout(() => location.reload(), 1000);
                        location.reload()
                    })

            }
        },
        // for coloring
        shadeColor(color, percent) {

            var R = parseInt(color.substring(1,3),16);
            var G = parseInt(color.substring(3,5),16);
            var B = parseInt(color.substring(5,7),16);

            R = parseInt(R * (100 + percent) / 100);
            G = parseInt(G * (100 + percent) / 100);
            B = parseInt(B * (100 + percent) / 100);

            R = (R<255)?R:255;  
            G = (G<255)?G:255;  
            B = (B<255)?B:255;  

            R = Math.round(R)
            G = Math.round(G)
            B = Math.round(B)

            var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
            var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
            var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

            return "#"+RR+GG+BB;
        },
        //seconds to hours and days converter
        ConvertSeconds(totalSeconds,show_sec) {
            d = Math.floor(totalSeconds/60/1440); // 60*24
            h = Math.floor((totalSeconds/60-(d*1440))/60);
            totalSeconds %= 3600;
            m = Math.floor(totalSeconds / 60);
            s = totalSeconds % 60;

            output = '';

            if (d>0) {
                output += d + " " + this.localeData.user_settings.days;
            }

            if (h>0) {
                output += " " + h + " " + this.localeData.user_settings.hours;
            }

            if (m>0) {
                output += " " + m + " " + this.localeData.user_settings.minutes;
            }

            if (show_sec) {
                output += " " + s + " " + this.localeData.user_settings.seconds;
            }

            return output;
        },
        ToggleStickyHeader(thead) {

            $('.hide-sticky-header-button i').toggleClass('down').toggleClass('up');

            if (parseInt(thead.css('top')) != -271) {
                window.localStorage['sticky_header_visible']=false;
                thead.animate({
                    top: '-271px'
                })
            } else {
                window.localStorage['sticky_header_visible']=true;
                thead.animate({
                    top: '0px'
                })
            }
        },
        showTips(a,index,type) {
            $('#tips-modal').modal({
                onHidden: function () {
                    //$('body').removeClass('scrolling');
                },
                    closable: true,
                    inverted: false,
                    blurring: this.settings.blurring
                }).modal('show');
        },
        showSettings(a,index,type) {
            $('#settings-modal').modal({
                onHidden: function () {
                    //$('body').removeClass('scrolling');
                },
                    closable: true,
                    inverted: false,
                    blurring: this.settings.blurring
                }).modal('show');
        },
        toggleHide(object) {
            $(object).transition({
                animation : "fade down",
                onHidden: function () {
                    if (object == '#charts-wrapper') {
                        window.localStorage.setItem("hidden_stats", true);
                        window.app.hidden_stats = true;
                        $(window.app.$refs.statsRef.stop_draws());

                    }
                },
                onVisible: function () {
                    if (object == '#charts-wrapper') {
                        window.localStorage.setItem("hidden_stats", false);
                        window.app.hidden_stats = false;
                        // force clear stats cookies before show filtered stats
                        window.app.clear_cookies('filtered_pie');
                        window.app.clear_cookies('filtered_pie_created');
                        window.app.clear_cookies('filtered_top_senders');
                        window.app.clear_cookies('filtered_top_senders_created');
                        window.app.clear_cookies('filtered_top_recipients');
                        window.app.clear_cookies('filtered_top_recipients_created');
                        $(window.app.$refs.statsRef.run_draws('overall_pie'));
                        $(window.app.$refs.statsRef.run_draws('filtered_pie'));
                        $(window.app.$refs.statsRef.run_draws('filtered_top_senders'));
                        $(window.app.$refs.statsRef.run_draws('filtered_top_recipients'));
                    }
                }
            });  
        },
        reset_page() {
            this.page_reset = true;
            this.page_count = 1;
            this.page = 1;
            this.page_reset = false;
        },
        format_date(text,format,tz) {
            if (tz) {
                var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
                return moment(new Date(text) - tzoffset).utc().format(format);
            } else {
                return moment(new Date(text)).utc().format(format);
            }
        },
        callResizableTableColumns($found_table) {

            // cleanup before colResizable() call
            if ($('.JCLRgrips').length > 0) {
                $found_table.colResizable({ 
                    disable : true,
                    flush: true
                });
                $('.JCLRgrips').remove();
            }
            // dirty timeout for correct table width set
            setTimeout(() => {
                $found_table.colResizable({
                    postbackSafe: true,
                    liveDrag:true,
                    useLocalStorage: true,
                    minWidth: 60,
                    disabledColumns: [8] // disable last column (button)
                });
            }, 600);
            

            // to fix resizable handlers height
            $('.JColResizer').css('max-height', $found_table.height());

        },
        callSort(th) {
                this.order = $(th).attr('id').split(' ').pop();
                if ($(th).hasClass("asc")) {
                    this.order_dir = "desc";   
                } else {
                    this.order_dir = "asc";
                }

                this.saveSort();
                this.loadEmails(true);
        },
        returnAllowedString(string) {
            string_check = string.match(/[()\\/$?+\[\]]/);
            if (string_check) {
                return string.substr(0, string_check.index);
            } else {
                return string;
            }
        },
        multiple_status_localize(object) {
            multiple_check = object.text().indexOf('multiple, see log lines below');
            if (this.localeData.emails_list.multiple_status == undefined) {
                text = this.fallbackLocaleData.emails_list.multiple_status
            } else {
                text = this.localeData.emails_list.multiple_status
            }
            if (multiple_check >=0) {
                str_to_localize = object.text().substr(multiple_check, object.text().length);
                localized_str = object.text().replace(str_to_localize, text);
                object.text(localized_str);
            }
        },
        status_localize(object,mode) {
            if (mode == 0) {
                obj_text = object.text();
            } else {
                obj_text = object;
            }
            if (window.app.localeData.filters['status_filter_'+obj_text] == undefined) {
                text2 = window.app.fallbackLocaleData.filters['status_filter_'+obj_text]
            } else {
                text2 = window.app.localeData.filters['status_filter_'+obj_text]
            }
            return text2;
        },
        multiple_check(object) {

            try {
                //console.log(object.text())
                parsed = JSON.parse(object.text())
                return parsed;
            } catch (e) {
                return null;
            }
        },
        multiple_process_view(array,object,mode) {
            // check parent type

            parent = $(object).parent()
            
            if ($(parent).prop('nodeName') == 'TD') {
                $(parent).empty();
                object = parent;

            } else {
                $(object).contents().filter(function(){ return this.nodeType != 1; }).remove();
                
            }
            var counter = 1;
            //console.log(array)
            for (const element of array) {


                if (typeof element === 'object' && element !== null) {
                    var txt = document.createTextNode(element['mail_to']);
                    var txt_alias = element['mail_to_alias'];
                } else {
                    var txt = document.createTextNode(element);
                }

                let span = document.createElement('span');
                
                $(span).append(txt);
                // dont append counter if there is only one element in array
                if (array.length > 1) {
                    $(span).prepend(counter+". ")
                    counter ++;
                }


                // add indicator and onhover event

                let tooltip = document.createElement('span');
                $(tooltip).text(txt_alias);

                if (this.localeData.filters.filter_link_tip == undefined) {
                    text = this.fallbackLocaleData.filters.filter_link_tip
                } else {
                    text = this.localeData.filters.filter_link_tip
                }
                window.app.bindMailtoFilterClick(tooltip);
                //if ((mode == 1) && (!(window.matchMedia('(max-width: 767px)').matches))) {
                if ((mode == 1) && (!(window.app.is_mobile))) {

                    $(span).addClass("multiple");
                    $(tooltip).attr('title', text + " «" + this.localeData.emails_list.mail_to + "»");
                    
                    if(typeof txt_alias !== "undefined") {
                        $(span).append("*");
                    }

                    $(span).append($('</br>'));
                    $(object).append(span);
                    dom_object = $(object).find(span);

                    variation = window.app.settings.dark ? 'inverted':null

                    if(typeof txt_alias !== "undefined") {
                        $(dom_object)
                          .popup({
                            onCreate: function(e){
                                $('.ui.popup').addClass('filter_linked')
                                // TODO fix title update
                                $th = $(object).closest('table').find('th').eq($(object).index());
                                if (window.app.localeData.filters.filter_link_tip == undefined) {
                                    text = window.app.fallbackLocaleData.filters.filter_link_tip
                                } else {
                                    text = window.app.localeData.filters.filter_link_tip
                                }
                                $(object).attr('title', text + " «" + $th.text().trim() + "»");
                            },
                            hideOnScroll: false,
                            target   : $(dom_object),
                            exclusive: true,
                            //preserve: true,
                            //content  :  txt_alias,
                            html: $(tooltip),
                            on    : 'hover',
                            hoverable: true,
                            position: 'top center',
                            variation: variation,
                            distanceAway: -7
                        });
                    }
                } else {

                    if(typeof txt_alias !== "undefined") {
                        $(tooltip).prepend("   [");
                        $(tooltip).append("]");
                    }

                    if (mode != 2) {
                        $(tooltip).attr('title', text + " «" + this.localeData.emails_list.mail_to + "»");
                    }

                    let container = document.createElement('div');
                    $(container).append(span);

                    if(typeof txt_alias !== "undefined") {
                        $(container).append(tooltip);
                    }
                    $(container).addClass("multiple_with_aliases");
                    $(object).addClass("multiple_with_aliases")
                    $(object).append(container);
                }
            }
            // fix of view of single or not long multiple recipients lists
            if (counter > 8) {
                object.addClass('multiple_mailtos')
            }
            return object
        },
        bindMailtoFilterClick (object,is_multiple) {
            $(object).on("click", function(e){
                if (!($('#mail-modal').is(':visible'))) {
                    if (is_multiple) {
                        multiple = window.app.returnAllowedString(e.target.innerText.replace(/[\[\]']+/g,''))
                        if (multiple.indexOf(". ") >= 0) {
                            multiple = multiple.split(". ")[1].replace('*', '').trim();
                        } else {
                            multiple = multiple.replace('*', '').trim();
                        }
                        //multiple = window.app.returnAllowedString(e.target.innerText.replace(/[\[\]']+/g,'')).split(". ")[1].replace('*', '').trim();
                    } else {
                        multiple = window.app.returnAllowedString(e.target.innerText.replace(/[\[\]']+/g,'')).replace('*', '').trim()
                    }

                   // multiple = window.app.returnAllowedString(e.target.innerText.replace(/[\[\]']+/g,'')).replace('*', '').trim()
                    window.app.search = multiple;
                    window.app.search_by = 'mail_to';
                    e.stopPropagation();
                    window.app.debounce_emails(true);
                }
            })
        },
        addFilterLink(element) {
            $td = element.find('td');
            if (this.localeData.filters.filter_link_tip == undefined) {
                text = this.fallbackLocaleData.filters.filter_link_tip
            } else {
                text = this.localeData.filters.filter_link_tip
            }
            $td.each(function(i, obj) {
                $th = $(obj).closest('table').find('th').eq($(obj).index());
                if (($th.attr('id') != "size") && ($th.attr('id') != "refresh-button")) {
                    $(obj).addClass('filter_linked');
                }
                if ($th.attr('id') == "id") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'id';
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }
                if ($th.attr('id') == "status") {
                    // localize status
                    object = $(obj).find('span');
                    object.addClass(object.text());
                    object.text(window.app.status_localize(object,0));

                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.status_filter = window.app.returnAllowedString($(obj).find('span').attr('class'));
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }
                if ($th.attr('id') == "mail_from") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'mail_from';
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }   
                if ($th.attr('id') == "mail_to") {

                    // localize multiple mail_to
                    object = $(obj).find('span');
                    if (window.app.multiple_check(object) !== null) {
                        multiple_object = window.app.multiple_process_view(window.app.multiple_check(object), object,1)
                        multiple_object_span = multiple_object.find('.multiple_with_aliases span')
                        if (multiple_object_span.length < 1) {
                            multiple_object_span = multiple_object
                        }

                        /*multiple_object_span.attr('title', text + " «" + $th.text().trim() + "»");
                        window.app.bindMailtoFilterClick(multiple_object_span);*/

                        if ($(multiple_object_span).parent().prop('nodeName') == 'DIV') {

                            $(multiple_object_span).attr('title', text + " «" + $th.text().trim() + "»");
                            window.app.bindMailtoFilterClick(multiple_object_span,true);
                        } else {
                            
                            $(multiple_object_span).attr('title', text + " «" + $th.text().trim() + "»");
                            window.app.bindMailtoFilterClick($(multiple_object_span).find('span.multiple'),true);
                        }

                    } else {
                        object.attr('title', text + " «" + $th.text().trim() + "»");
                        window.app.bindMailtoFilterClick(object,false);
                    }
                    
                }
                if ($th.attr('id') == "subject") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'subject';
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }
                if ($th.attr('id') == "timestamp") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.date_filter__gt = window.app.returnAllowedString($(obj).text());
                        window.app.date_filter__lt = window.app.returnAllowedString($(obj).text());
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }
                if ($th.attr('id') == "first_attempt") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.date_filter__gt = window.app.returnAllowedString($(obj).text());
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }
                if ($th.attr('id') == "last_attempt") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        window.app.date_filter__lt = window.app.returnAllowedString($(obj).text());
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
                }

            });
        },
        checkButtonArrow(thead) {

            if (thead.find('.hide-sticky-header-button').length == 0) {
                thead.append('<div class="hide-sticky-header-button"><i class="ui chevron up icon"></i></div>');
                $('.hide-sticky-header-button').on( "click", function() {
                    window.app.ToggleStickyHeader(thead);
                });
            }

            if (parseInt(thead.css('top')) != -271) {
                $('.hide-sticky-header-button i').removeClass('down').addClass('up');
            } else {
                $('.hide-sticky-header-button i').removeClass('up').addClass('down');
            }
        },
        toggleLoading(state) {
            if (state) {
                $('body').removeClass('scrolling');
                this.loading = true;
                $("#main-wrapper").hide();
                var isDark = (window.localStorage['dark'] === 'true');
                $('#loading-modal').modal({closable: false,blurring: this.settings.blurring,inverted: !isDark}).modal('show');
            } else {
                $('#loading-modal').modal('hide');
                $("#main-wrapper").show()
                this.loading = false;
                //$('body').addClass('scrolling');
            }
        },
        check_nothing_found(count,table,error) {
            // if no results don't show table and show notification
            if (count == 0) {
                if (!(error)) {
                    if (this.localeData.notie.nine == undefined) {
                        text = this.fallbackLocaleData.notie.nine
                    } else {
                        text = this.localeData.notie.nine
                    }
                    notie.alert({type: 'info', text: text });
                } else {
                    if (this.localeData.notie.eight == undefined) {
                        text = this.fallbackLocaleData.notie.eight
                    } else {
                        text = this.localeData.notie.eight
                    }
                    notie.alert({type: 'error', text: text, stay: true });
                }

                table.hide();
                $('.JCLRgrips').hide();
            }
        },
        loadAccounts() {
            var url = base_url2;
            var no_results = false;

            return fetch(url).then(function (response) {
                return response.json();
            }).then((res) => {
                this.accounts = res;
            })

        },
        validation(skip) {
                // looking for password inputs

                if ($("#password").length > 0) {
                    if (this.localeData.register.one == undefined) {
                        one = this.fallbackLocaleData.register.one
                    } else {
                        one = this.localeData.register.one
                    }
                    if (this.localeData.register.two == undefined) {
                        two = this.fallbackLocaleData.register.two
                    } else {
                        two = this.localeData.register.two
                    }
                    if (this.localeData.register.three == undefined) {
                        three = this.fallbackLocaleData.register.three
                    } else {
                        three = this.localeData.register.three
                    }
                    if (this.localeData.register.four == undefined) {
                        four = this.fallbackLocaleData.register.four
                    } else {
                        four = this.localeData.register.four
                    }
                    if (this.localeData.register.five == undefined) {
                        five = this.fallbackLocaleData.register.five
                    } else {
                        five = this.localeData.register.five
                    }
                    if (this.localeData.register.six == undefined) {
                        six = this.fallbackLocaleData.register.six
                    } else {
                        six = this.localeData.register.six
                    }
                            $('.ui.form').form({
                                on: 'submit',
                                errorFocus: 'false',
                                fields: {
                                    login: {
                                        identifier: 'login',
                                        rules: [
                                            {
                                                type: 'empty',
                                                prompt : one
                                            },
                                            {
                                                type: 'minLength[3]',
                                                prompt : two+'{ruleValue}'
                                            }
                                        ]
                                    },
                                    password: {
                                        identifier: 'password',
                                        rules: [
                                            {
                                                type: 'empty',
                                                prompt : three
                                            },
                                            {
                                                type: 'minLength[6]',
                                                prompt : four+'{ruleValue}'
                                            }
                                        ]
                                    },
                                    password2: {
                                        identifier: 'password2',
                                        rules: [
                                            {
                                                type: 'empty',
                                                prompt : six
                                            },
                                            {
                                                type: 'match[password]',
                                                prompt : five
                                            }
                                        ]
                                    }
                                },
                                onSuccess: function (event) {
                                    event.preventDefault();
                                    $('form')[0].submit();
                                    return false;
                                },
                                onFailure: function (event,fields) {
                                    if (skip) {
                                        $('.ui.form').form('set values', {
                                            password: 'blank_pass',
                                            password2: 'blank_pass'
                                        }).form('submit');
                                        return false;
                                    }
                                }
                            })
                }
        },
        loadEmails(refresh,processing) {

            fetch(base_url4).then(function (response) {
                return response.json();
            })
            .then((res) => {
                if (res['processing']) {
                    //console.log("Processing is running. Dont't refresh!")
                    if (!window.app.processing) {
                        if (this.localeData.notie.twenty_seven == undefined) {
                            text = this.fallbackLocaleData.notie.twenty_seven
                        } else {
                            text = this.localeData.notie.twenty_seven
                        }
                        window.app.processing = true
                        notie.alert({type: 'info', text: text, time: 5});

                    }
                    setTimeout(() => window.app.loadEmails(refresh,window.app.processing), 1000);
                    // disable loadEmails call gui elements
                    // prevent span links click 
                    $('#emails-list td.filter_linked span').addClass('disabled');
                } else {
                    if (window.app.processing) {
                        notie.hideAlerts();
                        window.app.processing = false
                        // enable loadEmails call gui elements
                        // prevent span links click
                        $('#emails-list td.filter_linked span').removeClass('disabled');
                        if ($('#mail-modal').modal('is active')) {
                            $('#mail-modal').modal('hide all');
                            setTimeout(() => {
                                window.app.email_modal_appearance('fade');
                            }, 1000);
                        }
                    }

                    this.check_date_lt();

                    // call to resresh countdown
                    this.setRefresh();


                    // check if search_error clear search text
                    if (this.search_error) {
                        this.search = "";
                        this.search_error = false;
                    }

                    // show loading modal on emails load
                    if (refresh) {
                        $('#main-wrapper').hide();
                        if (!(this.loading)) {
                            this.toggleLoading(true);
                        }
                    }

                    var url = base_url, queries = 0;
                    var no_results = false;

                    // load saved sort
                    this.loadSort();

                    if (this.search.length > 0) {
                        // add filter equal flag
                        url += `?equal=${this.isEqual}`;
                        queries += 1;
                    }

                    for (var f in this.email_filter) {
                        url += (queries === 0) ? '?' : '&';
                        url += `${f}=${this.email_filter[f]}`;
                        queries += 1;
                    }


                    url += (queries === 0) ? '?' : '&';
                    url += `page=${this.page}&limit=${this.settings.page_limit}`;
                    // add sort string
                    url += `&order=${this.order}&order_dir=${this.order_dir}`;

                    if (this.path_page == 2) {
                        element = $('#emails-list')[0];

                        return fetch(url).then(function (response) {
                            return response.json();
                        }).then((res) => {
                                this.emails = res['result'];
                                // get format from .env var
                                for (let i = 0; i < this.emails.length; i++) {
                                    // process messages with single recipient with alias
                                    if ((!(_.isEmpty(this.emails[i].mail_to_alias))) && (this.emails[i].mail_to.match(/\[[^\]]*]/g)==null)) {
                                        this.emails[i].mail_to = '[{"mail_to": "'+Object.keys(this.emails[i].mail_to_alias)+'", "mail_to_alias": "'+Object.values(this.emails[i].mail_to_alias)+'"}]';
                                    }
                                    //console.log(this.emails[i].mail_to)
                                    this.emails[i].timestamp = this.format_date(this.emails[i].timestamp,datetime_format,false);
                                    this.emails[i].first_attempt = this.format_date(this.emails[i].first_attempt,datetime_format,false);
                                    this.emails[i].last_attempt = this.format_date(this.emails[i].last_attempt,datetime_format,false);
                                }

                                this.page_count = res['total_pages'];
                                this.count = res['count'];

                                this.toggleLoading(false);
                                // check for updates
                                this.updateCheck();

                                // add advanced gui features
                                this.$nextTick(function () {
                                    $found_table = $('.emails-list');
                                    thead = $found_table.find('thead');

                                    // if no results don't show table and show notification
                                    this.check_nothing_found(this.count,$found_table,false);

                                    if (refresh) {
                                        // scroll to the table top
                                        if ($found_table.find('td:first').length > 0) {
                                            const element = $found_table.find('td:first')[0];
                                            var yOffset = 0;
                                            if (this.settings.resizable) {
                                                if (window.screen.width >= 768) {
                                                    // desktop
                                                    yOffset = -90; 
                                                } else {
                                                    //mobile
                                                    yOffset = -130; 
                                                }
                                            } else {
                                                if (window.screen.width >= 768) {
                                                    // desktop
                                                    yOffset = -thead.height();
                                                } else {
                                                    //mobile
                                                    yOffset = -thead.height()+130;
                                                }
                                                
                                            }
                                            const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                            // scrolling offset by hide-sticky-header-button height
                                            window.scrollTo({top: y, behavior: 'smooth'});
                                            // to force stats update by timestamp_gt
                                            window.app.setDuration();
                                        }
                                    } else {
                                        // set timestamp_gt if saving filters is off and refresh is false
                                        window.app.setDuration();
                                    }
                                    // style selected column for sort
                                    $found_table.find('#'+this.order).removeClass().addClass(this.order_dir);
                                    // if no results don't process empty table
                                    if (this.count != 0) {
                                        // add on row click title
                                        if (this.localeData.tips.five == undefined) {
                                            text = this.fallbackLocaleData.tips.five
                                        } else {
                                            text = this.localeData.tips.five
                                        }
                                        $found_table.find('tbody tr').attr('title', text);

                                        // bind sort to table headers
                                        $('.emails-list th:not(#refresh-button)').one('click',function(){
                                            window.app.callSort(this);
                                        });
                                        
                                        // add sticky table header
                                        if (this.settings.sticky) {
                                            thead.first().css({'top': 0, 'position':'sticky', 'z-index': 1, 'background':'inherit' })/*.addClass('sticky-visible')*/;
                                            // add show/hide sticky header button 
                                            //if (window.matchMedia('(max-width: 767px)').matches)
                                            if (window.app.is_mobile)
                                            {
                                                window.app.checkButtonArrow(thead);

                                                // check visibility state
                                                if (window.localStorage['sticky_header_visible'] !== "true") {
                                                    window.app.ToggleStickyHeader(thead);
                                                }
                                            }
                                        }

                                        if (this.settings.resizable) {
                                            // add class resizable
                                            $found_table.addClass('resizable');
                                            this.callResizableTableColumns($found_table);

                                            if (this.localeData.user_settings.resizable_title_tip == undefined) {
                                                text = this.fallbackLocaleData.user_settings.resizable_title_tip
                                            } else {
                                                text = this.localeData.user_settings.resizable_title_tip
                                            }
                                            thead.find('th').attr('title',text)
                                            // reset colResizable() widths states
                                            thead.find('th:not(#refresh-button)').one( "contextmenu", function() {
                                                window.localStorage.removeItem($found_table.attr('id'));
                                                window.app.loadEmails(true);
                                                return false;
                                            });
                                        } else {
                                            // cleanup if colResizable() was called earlier
                                            $('.JCLRgrips').hide();
                                            $found_table.removeClass('resizable');
                                        }
                                    }

                                    // styling of statuses and status filter dropdown
                                    if (!$found_table.find('td:nth-child(3)').hasClass('styled')) {
                                        $found_table.find('td:nth-child(3):contains("deferred")').addClass('styled')/*.prepend(this.settings.status_icon['deferred'])*/;
                                        $found_table.find('td:nth-child(3):contains("sent")').addClass('styled')/*.prepend(this.settings.status_icon['sent'])*/;
                                        $found_table.find('td:nth-child(3):contains("reject")').addClass('styled')/*.prepend(this.settings.status_icon['reject'])*/;
                                        $found_table.find('td:nth-child(3):contains("bounced")').addClass('styled')/*.prepend(this.settings.status_icon['bounced'])*/;
                                        $found_table.find('td:nth-child(3):contains("multiple")').addClass('styled')/*.prepend(this.settings.status_icon['multiple'])*/;
                                        $found_table.find('td:nth-child(3):contains("unknown")').addClass('styled')/*.prepend(this.settings.status_icon['unknown'])*/;
                                    }

                                    if (this.settings.colored) {
                                        var filter_email = $('#filter-email');

                                        for (let x in this.settings.status_color) {
                                            var color = this.settings.status_color[x];
                                            var text_color = "black";

                                            // coloring based on dark mode
                                            if (this.settings.dark) {
                                                if (x != 'NOFILTER') {
                                                    color = this.shadeColor(color,-40);
                                                } else {
                                                    color = this.settings.status_color.NOFILTER_dark;
                                                }
                                                text_color = "white";
                                            }

                                            $found_table.find('td:nth-child(3):contains("'+x+'")').closest('tr').css('background-color',color);

                                            $('#filter-email option[value="'+x+'"]').css({'background-color':color, 'color': text_color});
                                        } 

                                        // coloring current selected option

                                        filter_email.css({'background-color': filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor, 'color': text_color});
                                        filter_email.one('change', function () {
                                            filter_email.css({'background-color': filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor, 'color': text_color});
                                        });

                                    }
                                    // styling sorted column
                                    var sort_column = thead.find('th.asc, th.desc');
                                    sort_column.css('background-color', window.app.settings.status_color['sorted']);
                                    $('.emails-list tr:nth-child(n) td:nth-child('+(sort_column.index()+1)+')').each(function(i, obj) {
                                        $(obj).css('background-color',window.app.settings.status_color['sorted']);
                                    });

                                    // add filter links to table cells
                                    this.addFilterLink($found_table);

                                    // set min date based on housekeeping_days
                                    var min_date=new Date();
                                    if (housekeeping_days != 0) {
                                        min_date.setDate(min_date.getDate()-housekeeping_days);
                                    } else {
                                        min_date = undefined;
                                    }

                                    // samoilov add calendar date picker fields
                                    $('#rangestart').calendar({
                                      onChange: function(date, text, mode) {
                                          // fomat date to iso8601
                                          window.app.date_filter__gt = text;
                                      },
                                      text: this.localeData.calendar,
                                      endCalendar: $('#rangeend'),
                                      monthFirst: false,
                                      minDate: min_date,
                                      maxDate: new Date(Date.now()),
                                      formatter: {
                                        cellTime: 'H:mm',
                                        datetime: datetime_format
                                      }
                                    });
                                    $('#rangeend').calendar({
                                      onChange: function(date, text, mode) {
                                          // fomat date to iso8601
                                          window.app.date_filter__lt = text;
                                      },
                                      text: this.localeData.calendar,
                                      startCalendar: $('#rangestart'),
                                      monthFirst: false,
                                      minDate: min_date,
                                      maxDate: new Date(Date.now()),
                                      formatter: {
                                        cellTime: 'H:mm',
                                        datetime: datetime_format
                                      }
                                    });
                                    // set dark mode
                                    this.setDark($found_table);
                                    this.filters_changed = false;
                                });
                            this.updateCheck();
                        }).catch((res) => {
                            console.error('Error:', res);
                            if (this.path_page == 2) {
                                this.toggleLoading(false);
                                this.filters_changed = false;
                                this.waitForElm('#emails-list').then((elm) => {
                                    window.app.additional_styling(elm);
                                    window.app.check_nothing_found(this.count,$(elm),true);
                                })
                            }
                        });
                    }
                }
            })
            


            if (this.path_page == 1) {
                this.toggleLoading(false);
                
                this.waitForElm('#auth-list').then((elm) => {
                    window.app.additional_styling(elm);
                    this.loadAccounts();
                })
            }

            if (this.path_page == 0) {
                this.toggleLoading(false);
                window.app.additional_styling();
            }

        },
        auth() {
            window.location = path_prefix+'/auth';
        },
        emails_back() {
            window.location = path_prefix+'/emails';
        },
        additional_styling(element){

            //this.notieMessages ();

            this.$nextTick(function () {
                // set dark mode
                this.setDark($(element));
                $(element).show();
                this.updateCheck();
            });
            
        },
        logout() {
            // keep locale and mode settings
            var localeData = localStorage.getItem('localeData');
            var fallbackLocaleData = localStorage.getItem('fallbackLocaleData');
            var locale = localStorage.getItem('locale');
            var dark = localStorage.getItem('dark');
            var hidden_settings_tips = localStorage.getItem('hidden_settings_tips');
            var hidden_stats = localStorage.getItem('hidden_stats');
            localStorage.clear();
            localStorage.setItem('localeData',localeData);
            localStorage.setItem('fallbackLocaleData',fallbackLocaleData);
            localStorage.setItem('locale',locale);
            localStorage.setItem('dark',dark);
            localStorage.setItem('hidden_settings_tips',hidden_settings_tips);
            localStorage.setItem('hidden_stats',hidden_stats);

            // clear stats
            this.clear_cookies('filtered_pie');
            this.clear_cookies('filtered_pie_created');
            this.clear_cookies('filtered_top_senders');
            this.clear_cookies('filtered_top_senders_created');
            this.clear_cookies('filtered_top_recipients');
            this.clear_cookies('filtered_top_recipients_created');

            window.location = path_prefix+'/logout';

        },
        show_acc_modal(a,index,type) {
            this.edit_type = type;

            modal = $('#acc-modal');

            if (this.edit_type) {
                this.acc = a[index];
                this.index = index; 
            } else {
                this.acc = '';
                this.index = '';    
            }

            modal.modal({
                onHidden: function () {
                    //$('body').removeClass('scrolling');
                },
                    closable: true,
                    inverted: false,
                    blurring: this.settings.blurring
                }).modal('show');
            window.app.validation(false);
        },
        getStatusIcon(m,index) {
            if (m[index] !== undefined) {
                mail_obj = JSON.parse(JSON.stringify(m[index]))
                return this.settings.status_icon[mail_obj.status.code]
            }
        },
        getTLSIcon(m,index) {
            if (window.app.localeData.emails_list.status_tls == undefined) {
                    text_tls = window.app.fallbackLocaleData.emails_list.status_tls
                } else {
                    text_tls = window.app.localeData.emails_list.status_tls
            }
            if (window.app.localeData.emails_list.status_notls == undefined) {
                    text_no_tls = window.app.fallbackLocaleData.emails_list.status_notls
                } else {
                    text_no_tls = window.app.localeData.emails_list.status_notls
            }
            if (m[index] !== undefined) {
                mail_obj = JSON.parse(JSON.stringify(m[index]))
                var found = false
                mail_obj.lines.forEach(element => {
                    if (element['message'].indexOf("TLS") >=0) {
                        found = true
                    }
                });
            } else {
                console.log("Something went wrong with getTLS icon!");
            }

            return found ? [text_tls,window.app.settings.status_icon['tls']] : [text_no_tls,window.app.settings.status_icon['no_tls']]
            /*} else {
                console.log("Something went wrong with getTLS icon!");
                return [this.settings.status_icon['unknown'],'question']
            }*/
        },
        email_modal_appearance(transition) {

            if ($('#mail-modal').modal('is active')) {
                $('#mail-modal').modal('hide all');
            }

            $('#mail-modal').modal({
            onHide: function (e) {
                // for no swipe dimmer blinking

                if (e.prop('nodeName') != 'DIV') {
                    $('#app > div.ui.dimmer.modals').removeClass('visible');
                    $('#app > div.ui.dimmer.modals').removeClass('active');
                    $('#app > div.ui.dimmer.modals').removeClass('hidden');
                    setTimeout(() => $('#app > div.ui.dimmer.modals').hide(), 1000);
                }
            },
            onHidden: function () {
                // fix of loading modal appears on top instead of centered
                $('body').removeClass('scrolling');
                this.swiped = false;
                window.app.arrowKeyUnBind();
            },
            onShow: function () {
                //$('#mail-modal').addClass('scrolling');
            },
            onVisible: function () {
                // fix of mail-modal appears on top instead of centered
                $('#mail-modal').addClass('scrolling');
                // for no swipe dimmer blinking
                $('body').removeClass('dimmed');
                $('body').removeClass('scrolling');
                window.app.arrowKeyBind($(this)[0]);
                window.app.swipeBind($(this)[0]);
                // move to the top of modal content
                $('#mail-modal').find('.scrolling.content')[0].scrollTo({top: 0, behavior: 'smooth'});
            },
            closable: true,
            inverted: false,
            blurring: window.app.settings.blurring,
            centered: true,
            transition: transition,
            duration: 300,
            //dimmerSettings: { opacity: 0.3 }
            }).modal('show');
        },
        show_email_modal(m,index,key,transition) {

            /*console.log(key)
            console.log(index)*/

            this.msg = m[index];
            this.index = index;
            this.msg_length = m.length;

            this.email_modal_appearance(transition);


            // fix of fomantic ui scrolling appear on the many related log lines modals
            //$('body').addClass('scrolling');
            // apply styling to modal
            this.$nextTick(function () {

                // for dimmer blurring apply after modal show
                if (window.app.settings.blurring) {
                    $('body').addClass('blurring');
                }
                
                object = $('#email-metadata #mail_to_details')
                if (window.app.multiple_check(object) !== null) {
                    window.app.multiple_process_view(window.app.multiple_check(object), object,2)
                }
                window.app.multiple_status_localize($('#email-metadata code'));

                if (this.settings.colored) {
                    var brightness = 0;
                    if (this.settings.dark) {
                        brightness = -40;
                    }
                    //console.log(m[index].status.code)
                    //console.log($('#email-metadata #status_code').parent())
                    //$('#email-metadata td:contains("'+m[index].status.code+'")').css('background-color',this.shadeColor(this.settings.status_color[m[index].status.code],brightness));
                    $('#email-metadata #status_code').parent().css('background-color',this.shadeColor(this.settings.status_color[m[index].status.code],brightness));
                    $('#mail-modal .header').css('background-color',this.shadeColor(this.settings.status_color[m[index].status.code],brightness));


                } else {
                    // change to inherit due to dark mode changes
                    //$('#email-metadata td:contains("'+m[index].status.code+'")').css('background-color','inherit');
                    $('#email-metadata #status_code').parent().css('background-color','inherit');
                    $('#mail-modal .header').css('background-color','inherit');
                }

                // status localize
                $('#email-metadata #status_code').text(window.app.status_localize($('#email-metadata #status_code'),0))
            });
        },
        settings_saved(val) {
            this.onSettingsUpdated(val);
            if (this.localeData.notie.two == undefined) {
                text = this.fallbackLocaleData.notie.two
            } else {
                text = this.localeData.notie.two
            }
            notie.alert({type: 'success', text: text });
        },
        settings_loaded(val) {
            this.onSettingsUpdated(val);
            //notie.alert({type: 'info', text: `User settings are loaded from Local Storage`, time: 2})
        },
        saveFilters() {
            window.localStorage['saved_filters.isEqual']=this.isEqual;
            window.localStorage['saved_filters.search']=this.search;
            window.localStorage['saved_filters.status_filter']=this.status_filter;
            window.localStorage['saved_filters.search_by']=this.search_by;
            window.localStorage['saved_filters.date_filter__gt']=this.date_filter__gt;
            window.localStorage['saved_filters.date_filter__lt']=this.date_filter__lt;
        },
        saveSort() {
            window.localStorage['order']=this.order;
            window.localStorage['order_dir']=this.order_dir;
        },
        loadSort() {            
            if ('order_dir' in window.localStorage) {
                this.order_dir = window.localStorage['order_dir'];
            }
            if ('order' in window.localStorage) {
                this.order = window.localStorage['order'];
            }
        },
        loadFilters() {
            if ('saved_filters.isEqual' in window.localStorage) {
                // convert string to  boolean
                this.isEqual = (window.localStorage['saved_filters.isEqual'] === 'true');
            }
            if ('saved_filters.search' in window.localStorage) {
                this.search = window.localStorage['saved_filters.search'];
            }
            if ('saved_filters.status_filter' in window.localStorage) {
                this.status_filter = window.localStorage['saved_filters.status_filter'];
            }
            if ('saved_filters.search_by' in window.localStorage) {
                this.search_by = window.localStorage['saved_filters.search_by'];
            }
            if ('saved_filters.date_filter__gt' in window.localStorage) {
                if (window.localStorage['saved_filters.date_filter__gt'] == 'Invalid date') {
                     window.localStorage.setItem("saved_filters.date_filter__gt", '');
                }
                this.date_filter__gt = window.localStorage['saved_filters.date_filter__gt'];
            }
            if ('saved_filters.date_filter__lt' in window.localStorage) {
                if (window.localStorage['saved_filters.date_filter__lt'] == 'Invalid date') {
                     window.localStorage.setItem("saved_filters.date_filter__lt", '');
                }
                this.date_filter__lt = window.localStorage['saved_filters.date_filter__lt'];
            }

            if ((this.search !== "") || (this.status_filter !=="NOFILTER") || (this.search_by !=="id") || (this.date_filter__gt !=="") || (this.date_filter__lt !=="")) {
                //notie.alert({type: 'warning', text: 'Saved filters are loaded successfully'});
                if (this.localeData.notie.three == undefined) {
                    text = this.fallbackLocaleData.notie.three
                } else {
                    text = this.localeData.notie.three
                }
                notie.alert({type: 'warning', text: text});
            }
        },
        resetFilters() {
            this.search = "";
            this.isEqual = true;
            this.status_filter = "NOFILTER";
            this.search_by = "id";
            // change start date based on saving filters option?
            if (this.settings.filters) {
                // don't clearup date_filter__gt for optimization purposes! show warning!
                //this.date_filter__gt = "";
                if (this.localeData.notie.twenty_one == undefined) {
                    text = this.fallbackLocaleData.notie.twenty_one
                } else {
                    text = this.localeData.notie.twenty_one
                }
                notie.alert({type: 'warning', text: text, time: 10 });

            } else {
                this.setDuration();
            }
            this.date_filter__lt = "";
            var text_color = 'black';
            if (this.settings.dark) {
                text_color = 'white';
                color = this.settings.status_color.NOFILTER_dark;
            } else {
                color = this.settings.status_color.NOFILTER;
            }
            $("#filter-email").css({'background-color':color,'color': text_color});
            if (this.localeData.notie.four == undefined) {
                text = this.fallbackLocaleData.notie.four
            } else {
                text = this.localeData.notie.four
            }
            this.reset_page();
            this.debounce_emails(true);
        },
        saveCurPage() {
            window.localStorage['cur_page']=this.page;
        },
        setDuration() {
            this.$nextTick(function () {
                if (!(this.settings.filters)) {
                    var startdate = new Date(new Date(Date.now()) - this.settings.default_period * 60000/* - tzoffset*/);
                    startdate = this.format_date(startdate,datetime_format,true);
                    this.date_filter__gt = startdate;
                }
            });
        },
        countdown (time) {
          // Update every second
            clearInterval(this.contdown_timer);
            if (time >= 1) {
                this.contdown_timer = setInterval(function() {
                    if (window.app.contdown_sec >= 1) {
                        window.app.contdown_sec = --time;
                        window.app.contdown = window.app.ConvertSeconds(window.app.contdown_sec,true);
                    }
                }, 1000);
            }
        },
        setRefresh() {
            let multiplier = 60; //minute
            // autorefresh
            this.$nextTick(function () {
                clearInterval(window.app.timer);
                // hide rotation animation after 1s
                setTimeout(() => $('#navi .sync.icon').removeClass('rotate'), 1000);
                if (window.app.settings.refresh > 0) {

                    window.app.contdown_sec = window.app.settings.refresh * multiplier;
                    window.app.timer = setInterval(function(){
                        if (window.app.settings.refresh !== undefined) {
                            // show rotation animation
                            $('#navi .sync.icon').addClass('rotate');
                            // check if processing then skip autorefresh
                            if (!(window.app.processing)) {
                                window.app.loadEmails(false);
                            }
                        }
                    }, window.app.settings.refresh * multiplier * 1000);
                } else {
                    window.app.contdown_sec = 0;
                    window.app.contdown = '';
                }
                window.app.countdown (window.app.contdown_sec);
            });
        },
        setDark(table) {
            this.$nextTick(function () {
                if ('dark' in window.localStorage) {
                    if (window.localStorage['dark'] === 'true') {
                        $('#app').addClass('dark');
                        $('#user-settings-wrapper').addClass('inverted');
                        $('#user-settings-wrapper > div').addClass('inverted');
                        $('#tips > div').addClass('inverted');
                        $('#filters-wrapper').addClass('inverted');
                        $('#charts-wrapper').addClass('inverted');
                        if (table) {
                            table.addClass('inverted');
                        }
                        if (($("div.logo.login").length > 0) || ($('.api_error_container').length > 0)) {
                            this.waitForElm('#login-form-wrapper').then((elm) => {
                                $(elm).addClass('inverted');
                            });
                            this.waitForElm('#footer').then((elm) => {
                                $(elm).addClass('inverted');
                            });
                            this.waitForElm('.api_error_container').then((elm) => {
                                $(elm).addClass('inverted');
                            });
                        } else {
                            $('#footer').addClass('inverted');
                        }
                    } else {
                        $('#app').removeClass('dark');
                        $('#user-settings-wrapper').removeClass('inverted');
                        $('#user-settings-wrapper > div').removeClass('inverted');
                        $('#tips > div').removeClass('inverted');
                        $('#filters-wrapper').removeClass('inverted');
                        $('#charts-wrapper').removeClass('inverted');
                        if (table) {
                            table.removeClass('inverted');
                        }
                        $('#footer').removeClass('inverted');
                    }
                }
            })
        },
        loadCurPage() {
            if ('cur_page' in window.localStorage) {
                this.page = Number.parseInt(window.localStorage['cur_page']);
            }
        },
        onSettingsUpdated(val) {

            let v = JSON.parse(JSON.stringify(val));
            v.page_limit = Number.parseInt(v.page_limit);
            v.refresh = Number.parseInt(v.refresh);
            v.default_period = Number.parseInt(v.default_period);


            let updatePage = (v.default_period !== Number.parseInt(this.settings.default_period) || v.page_limit !== Number.parseInt(this.settings.page_limit) || v.refresh !== Number.parseInt(this.settings.refresh) /*|| v.marquee !== this.settings.marquee || v.dark !== this.settings.dark*/ || v.colored !== this.settings.colored || v.sticky !== this.settings.sticky || v.resizable !== this.settings.resizable || v.locale !== this.settings.locale || v.filters !== this.settings.filters);
            

            let reload = false;

            // if locale has changed we need to remove localeData from localStorage
            if ((this.settings.locale !== window.localStorage['locale']) && (this.settings.locale !== undefined)) {
                window.localStorage.removeItem('localeData');
                // load current locale data
                this.settings.locale = v.locale;
                this.loadLocaleMessages();
                reload = true;
            }

            // fix for multiple_process_view popup invert set
            if (this.settings.dark !== undefined) {
                if (v.dark !== this.settings.dark) {
                    $("#settings-modal").modal({
                        onHidden: function () {
                            window.app.toggleLoading(true);
                            $("#settings-modal").hide();
                            location.reload();
                        }
                    }).modal("hide all");
                    //this.toggleLoading(true);
                    //location.reload();
                }
            }

            this.settings = v;
            this.loaded_settings = true;

            if (updatePage) {
                // reset date filter after save filters is switched on
                if (this.settings.filters) {
                    // don't clearup date_filter__gt for optimization purposes! show warning!
                    //this.date_filter__gt = "";
                    //this.date_filter__lt = "";
                } else {
                    this.setDuration();
                }

                this.setRefresh();

                if (reload) {
                    $("#settings-modal").modal({
                        onHidden: function () {
                            // show loading modal before reload
                            window.app.toggleLoading(true);
                            location.reload();
                        }
                    }).modal("hide");
                } else {
                    $("#settings-modal").modal({
                        onHidden: function () {
                            window.app.debounce_emails(true);
                        }
                    }).modal("hide");

                }

            }

        },
        // function for setTimeout in waiting loops
        waitForElm(selector) {
            return new Promise(resolve => {
                if (document.querySelector(selector)) {
                    return resolve(document.querySelector(selector));
                }

                const observer = new MutationObserver(mutations => {
                    if (document.querySelector(selector)) {
                        resolve(document.querySelector(selector));
                        observer.disconnect();
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        },
        notieMessages () {
            // if current browser locale is not supported
            if (window.localStorage["falled_back"]) {
                text = "Current browser «"+ navigator.language.toUpperCase() + "» locale is not supported. Falling back to default «EN» locale!";
                window.localStorage.removeItem("falled_back");
                notie.alert({type: 'info', text: text});
            }

             // login notie messages
            if (notie_message == 'api_error') {
                if (this.localeData.notie.eight == undefined) {
                    text = this.fallbackLocaleData.notie.eight
                } else {
                    text = this.localeData.notie.eight
                }
                notie.alert({type: 'error', text: text})
            }
            if (notie_message == 'unauth') {
                if (this.localeData.notie.six == undefined) {
                    text = this.fallbackLocaleData.notie.six
                } else {
                    text = this.localeData.notie.six
                }
                notie.alert({type: 'error', text: text})
            }
            if (notie_message == 'logged_out') {
                if (this.localeData.notie.seven == undefined) {
                    text = this.fallbackLocaleData.notie.seven
                } else {
                    text = this.localeData.notie.seven
                }
                notie.alert({type: 'success', text: text});
            }
            if (notie_message == 'pass_error') {
                if (this.localeData.notie.five == undefined) {
                    text = this.fallbackLocaleData.notie.five
                } else {
                    text = this.localeData.notie.five
                }
                notie.alert({type: 'error', text: text});
            }
            if (notie_message == 'user_created') {
                if (this.localeData.notie.twelve == undefined) {
                    text = this.fallbackLocaleData.notie.twelve
                } else {
                    text = this.localeData.notie.twelve
                }
                notie.alert({type: 'success', text: text});
            }

            if (notie_message == 'user_edited') {
                if (this.localeData.notie.fourteen == undefined) {
                    text = this.fallbackLocaleData.notie.fourteen
                } else {
                    text = this.localeData.notie.fourteen
                }
                notie.alert({type: 'success', text: text});
            }

             if (notie_message == 'user_deleted') {
                if (this.localeData.notie.fifteen == undefined) {
                    text = this.fallbackLocaleData.notie.fifteen
                } else {
                    text = this.localeData.notie.fifteen
                }
                notie.alert({type: 'success', text: text});
            }

            if (notie_message == 'user_creation_error') {
                if (this.localeData.notie.sixteen == undefined) {
                    text = this.fallbackLocaleData.notie.sixteen
                } else {
                    text = this.localeData.notie.sixteen
                }
                notie.alert({type: 'error', text: text});
            }

            if (notie_message == 'no_users_found') {
                if (this.localeData.notie.thirteen == undefined) {
                    text = this.fallbackLocaleData.notie.thirteen
                } else {
                    text = this.localeData.notie.thirteen
                }
                notie.alert({type: 'warning', text: text});
            }
            if (notie_message == 'bind_pass_error') {
                if (this.localeData.notie.seventeen == undefined) {
                    text = this.fallbackLocaleData.notie.seventeen
                } else {
                    text = this.localeData.notie.seventeen
                }
                notie.alert({type: 'error', text: text, stay: 'true'});
            }

            if (notie_message == 'no_ldap_users_found') {
                if (this.localeData.notie.eighteen == undefined) {
                    text = this.fallbackLocaleData.notie.eighteen
                } else {
                    text = this.localeData.notie.eighteen
                }
                notie.alert({type: 'error', text: text, stay: 'true'});
            }
            if (notie_message == 'other_ldap_error') {
                if (this.localeData.notie.twenty_five == undefined) {
                    text = this.fallbackLocaleData.notie.twenty_five
                } else {
                    text = this.localeData.notie.twenty_five
                }
                notie.alert({type: 'error', text: text, stay: 'true'});
            }
            if (notie_message == 'unauth_ldap') {
                if (this.localeData.notie.nineteen == undefined) {
                    text = this.fallbackLocaleData.notie.nineteen
                } else {
                    text = this.localeData.notie.nineteen
                }
                notie.alert({type: 'error', text: text });
            }
            if (notie_message == 'mlp_upgraded') {
                if (this.localeData.notie.twenty == undefined) {
                    text = this.fallbackLocaleData.notie.twenty
                } else {
                    text = this.localeData.notie.twenty
                }
                notie.alert({type: 'warning', text: text, stay: 'true'});
            }
        },
        getCookie(name) {
          let matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
          ));
          return matches ? decodeURIComponent(matches[1]) : undefined;
        },
        clear_cookies(name) {
            // clear all cookies
            var cookies = document.cookie.split(";");
            if (!(name)) {
                for(var i=0; i < cookies.length; i++) {
                    var equals = cookies[i].indexOf("=");
                    var name = equals > -1 ? cookies[i].substr(0, equals) : cookies[i];
                    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
                }
            } else {
                document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
            }
        },
        upgradeCheck (){
            if ((!(this.getCookie('mlp_current_version')))||(this.getCookie('mlp_current_version') != parser_version)) {
                // clear localstorage
                localStorage.clear();

                var mlp_current_version = "mlp_current_version="+parser_version+"; max-age=2147483647";
                var mlp_current_version_cookie = this.getCookie('mlp_current_version')

                this.clear_cookies();

                // store current mlp version for automatic localStorage and cookie cleanup after mlp upgrade 
                document.cookie = mlp_current_version;

                if (mlp_current_version_cookie) {
                    notie_message = "mlp_upgraded";
                    this.notieMessages ();
                    setTimeout(() => {
                        window.location = path_prefix+'/logout';
                    }, 5000);
                } else {
                    window.location = path_prefix+'/logout';
                }
            }


        },
        async updateCheck() {
            if (!(this.getCookie('mlp_latest_version'))) {
                await $.getJSON("https://api.github.com/repos/drlight17/mta-log-parser/releases/latest")
                .done(function(json_data_fallback) {
                    response = JSON.parse(JSON.stringify(json_data_fallback));
                    document.cookie = "mlp_latest_version="+response["tag_name"].substring(1)+"; max-age=3600";
                    //if (parser_version != response["tag_name"].substring(1)) {
                    if (parser_version.localeCompare(response["tag_name"].substring(1), undefined, { numeric: true, sensitivity: 'base' }) == '-1') {
                        window.app.waitForElm('#footer > div > span:nth-child(3)').then((elm) => {
                            if (window.app.localeData.footer.four == undefined) {
                                text = window.app.fallbackLocaleData.footer.four
                            } else {
                                text = window.app.localeData.footer.four
                            }
                            if (window.app.localeData.footer.five == undefined) {
                                text2 = window.app.fallbackLocaleData.footer.five
                            } else {
                                text2 = window.app.localeData.footer.five
                            }
                            if ($('#update_available').length == 0) {
                                $(elm).append(' | '+'<span id="update_available" class="blinking">'+text+" <a href='https://github.com/drlight17/mta-log-parser/releases/latest' target='_BLANK'>"+response["tag_name"].substring(1)+"</a>"+text2+'</span>');
                            }
                        });
                    }
                })

                .fail(function(json_data_fallback) {
                    document.cookie = "mlp_latest_version="+parser_version+"; max-age=3600";
                    console.log("Failed to get latest repo version!");
                    console.log(JSON.parse(JSON.stringify(json_data_fallback)))
                })
            } else {
                //if (parser_version != this.getCookie('mlp_latest_version')) {
                if (parser_version.localeCompare(this.getCookie('mlp_latest_version'), undefined, { numeric: true, sensitivity: 'base' }) == '-1') {
                    window.app.waitForElm('#footer > div > span:nth-child(2)').then((elm) => {
                        if (window.app.localeData.footer.four == undefined) {
                            text = window.app.fallbackLocaleData.footer.four
                        } else {
                            text = window.app.localeData.footer.four
                        }
                        if (window.app.localeData.footer.five == undefined) {
                            text2 = window.app.fallbackLocaleData.footer.five
                        } else {
                            text2 = window.app.localeData.footer.five
                        }

                        if ($('#update_available').length == 0) {
                            $(elm).append(' | '+'<span id="update_available" class="blinking">'+text+" <a href='https://github.com/drlight17/mta-log-parser/releases/latest' target='_BLANK'>"+this.getCookie('mlp_latest_version')+"</a>"+text2+'</span>');
                        }
                    });
                }
            }
        },
        get_URL_params () {
            if (sent_args != '') {
                check_params = sent_args.split("?")[1]
            } else {
                check_params = window.location.search
            }
            let urlParams = new URLSearchParams(check_params);

            if ((this.path_page == 2)&&(check_params != '')) {
                if (!(this.settings.filters)) {
                     window.localStorage.setItem("filters", true);
                     // set children filters value to true
                     window.app.$refs.localSettings.settings.filters = true;
                     window.app.$refs.localSettings.saveSettings();

                }
            }

            for (const entry of urlParams.entries()) {
                if (entry[0] == 'equal') {
                    this.isEqual = (entry[1] === 'true');
                }
                if (entry[0] == 'search') {
                    this.search = entry[1]
                }
                if (entry[0] == 'status_filter') {
                    if (entry[1] == 'sent' || entry[1] == 'reject' || entry[1] == 'deferred' || entry[1] == 'bounced' || entry[1] == 'multiple' || entry[1] == 'unknown') {
                        this.status_filter = entry[1];
                    } else {
                        this.status_filter = 'NOFILTER';
                    }
                }
                if (entry[0] == 'search_by') {
                    if (entry[1] == 'id' || entry[1] == 'mail_from' || entry[1] == 'mail_to' || entry[1] == 'subject' || entry[1] == 'log_lines') {
                        this.search_by = entry[1]
                    }
                }
                if (entry[0] == 'date_filter__gt') {
                    if (this.settings.filters) {
                        this.date_filter__gt = entry[1]
                    }/* else {
                        if (this.localeData.notie.twenty_four == undefined) {
                            text = this.fallbackLocaleData.notie.twenty_four
                        } else {
                            text = this.localeData.notie.twenty_four
                        }
                        notie.alert({type: 'warning', text: text });
                    }*/
                }
                if (entry[0] == 'date_filter__lt') {
                    //this.date_filter__lt = this.format_date(entry[1],datetime_format,true);
                    this.date_filter__lt = entry[1]
                }
                if (entry[0] == 'page') {
                    this.page = entry[1];
                    this.saveCurPage();
                }
                if (entry[0] == 'order') {
                    if (entry[1] == 'timestamp' || entry[1] == 'id' || entry[1] == 'status' || entry[1] == 'mail_from' || entry[1] == 'mail_to' || entry[1] == 'subject' || entry[1] == 'size' || entry[1] == 'first_attempt' || entry[1] == 'last_attempt') {
                        this.order = entry[1]
                        this.saveSort();
                    }
                }
                if (entry[0] == 'order_dir') {
                    if (entry[1] == 'asc' || entry[1] == 'desc') {
                        this.order_dir = entry[1]
                        this.saveSort();
                    }
                }
            }

            // clear browser address bar after params get
            history.pushState(null, "", location.href.split("?")[0]);
        },
        unsecuredCopyToClipboard(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus({preventScroll: true});
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Unable to copy to clipboard', err);
            }
            document.body.removeChild(textArea);
        },
        async shareLink() {
            link = window.location.origin+window.location.pathname+'?'
            link += 'equal='+this.isEqual

            if (this.search) {
                link += '&search='+this.search
            }

            if (this.search_by) {
                link += '&search_by='+this.search_by
            }

            if (this.status_filter) {
                link += '&status_filter='+this.status_filter
            }

            if (this.date_filter__gt) {
                link += '&date_filter__gt='+this.date_filter__gt
            }

            if (this.date_filter__lt) {
                link += '&date_filter__lt='+this.date_filter__lt
            }

            link += '&page='+this.page+'&order='+this.order+'&order_dir='+this.order_dir;

            if (window.isSecureContext && navigator.clipboard) {
                navigator.clipboard.writeText(link);
            } else {
                this.unsecuredCopyToClipboard(link);
            }

            if (this.localeData.notie.twenty_three == undefined) {
                text = this.fallbackLocaleData.notie.twenty_three
            } else {
                text = this.localeData.notie.twenty_three
            }
            notie.alert({type: 'info', text: text });

        }
    },
    mounted() {

        //TODO need to fix dropdown update
        //$('select.dropdown').addClass("menu");
        //$('select.dropdown ').addClass("dropdown ui");

        // detect mobile view
        this.onResize();
        window.addEventListener('resize', this.onResize);

        // detect dark mode
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && (localStorage.getItem('dark') === null)) {
            this.settings.dark = true;
            localStorage.setItem('dark','true');
        }

        // fix of footer position
        this.waitForElm('#footer').then((elm) => {
            if ($("div.logo.login").length > 0) {
                $(elm).css({'position':'absolute', 'bottom': 0, 'width': '99%'});
            }
        });
        

        this.setDark();

        // get current page path
        if (window.location.pathname.slice(-1)=='/') {
            path = window.location.pathname.slice(0, -1)
        } else {
            path = window.location.pathname
        }

        if (path.split('/').reverse()[0] == '') {
            this.path_page = 0;
        }
        if (path.split('/').reverse()[0] == 'auth') {
            this.path_page = 1;
        }
        if (path.split('/').reverse()[0] == 'emails') {
            this.path_page = 2;
        }

        // set refresh interval
        this.setRefresh();

        // show loading modal on the page load
        this.toggleLoading(true);
        // check if no saved locale
        if (localStorage.getItem('locale') === null) {
            this.settings.locale = navigator.language.slice(0,2).toLowerCase() || navigator.userLanguage.slice(0,2).toLowerCase();

            localStorage.setItem('locale',this.settings.locale);
        } else {
            this.settings.locale = localStorage.getItem('locale');
        }
        
        this.loadLocaleMessages();

        // check for mlp upgraded
        this.upgradeCheck();

        $('select.dropdown option').addClass("item");  
        
        // check emails applicapable functions
        if (this.path_page == 2) {
            // check setDuration option set
            this.setDuration();

            // load saved filters
            if (this.settings.filters) {
                this.loadFilters();
            }
        }

        this.$nextTick(function () {

            // check and override filters based on the URL params
            this.get_URL_params();

            // apply mail domain from current domain URL if .env MAIL_DOMAIN is empty
            if (mail_domain == '') {
                $('h1 > span').text(window.location.hostname);
            }
            this.notieMessages ();

            // focus on password input timeout
            this.waitForElm('input.ui').then((elm) => {
                elm.focus();
                window.app.validation(false);
            });

            // check if we are on login or api_error screen
            if (this.path_page == 0) {
                if (notie_message != "mlp_upgraded") {
                    this.toggleLoading(false);
                    this.updateCheck();
                }
            }

            // load saved page
            this.loadCurPage();

            // add back to the top button
            addBackToTop({
              diameter: 56,
              scrollDuration: 500,
              backgroundColor: '#767676',
              textColor: '#fff',
              showWhenScrollTopIs: $(window).height()/2,
              zIndex: 5,
              cornerOffset: 30
            });
            this.filters_changed = false;

            // hide load if at error page
            if ($('.api_error_container').length > 0 ) {
                this.toggleLoading(false);
                this.updateCheck();
            }
        });
    },
    beforeDestroy() { 
        window.removeEventListener('resize', this.onResize); 
    }
});
