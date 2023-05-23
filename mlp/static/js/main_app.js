// append path_prefix to the base_url if any is set
const base_url = document.currentScript.getAttribute('path_prefix')+'/api/emails';
// get datetime_format from .env
var datetime_format = document.currentScript.getAttribute('datetime_format');
if (datetime_format == '') {
        datetime_format = 'YYYY-MM-DDTHH:mm:ss.sssZ';
}
// get HOUSEKEEPING_DAYS from .env
var housekeeping_days = document.currentScript.getAttribute('housekeeping_days');
if (housekeeping_days == '') {
        housekeeping_days = 0;
}

// get locale langs
var lang_files = JSON.parse(document.currentScript.getAttribute('lang_files'));

//var notie_message_code = document.currentScript.getAttribute('notie_message_code');
var notie_message = document.currentScript.getAttribute('notie_message');

const app = Vue.createApp({
    // to work with both quart and vue variables on the template pages
    delimiters: ['[[', ']]'],
    data() {
        return {
            localeData: [],
            fallbackLocaleData: [],
            locales: lang_files,
            loading: true,
            error: null,
            emails: [],
            search: "",
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
            settings: [],
            loaded_settings: false
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
                this.search_by!== "id" || this.search.length > 0 || this.status_filter !== "NOFILTER" || this.date_filter__gt.length > 0 || this.date_filter__lt.length > 0
                )
        },
        has_error() {
            return (
                (typeof this.error) !== 'undefined' &&
                this.error !== '' &&
                this.error !== null &&
                this.error !== false
            )
        }
    },
    watch: {
        search(val) {
            // text input validation
            if (val.match(/[()\\/$?+\[\]]/)) {
                if (this.localeData.notie.one == undefined) {
                    text = this.fallbackLocaleData.notie.one
                } else {
                    text = this.localeData.notie.one
                }
                notie.alert({type: 'error', text: text+val+'&quot;</b>'});
                $('#text_search').focus();
                $('#text_search').css('color','red');
                //this.search = this.search.slice(0,-1);
                return;
            } else {
                $('#text_search').css('color', 'initial');
                if (this.settings.filters) {
                    this.saveFilters();
                }
            }
            this.reset_page();
            this.debounce_emails(true);
        },
        search_by(val) {
            if (this.search !== "") {
                if (this.settings.filters) {
                    this.saveFilters();
                }
                this.reset_page();
                this.debounce_emails(true);
            }
        },
        status_filter(val) {
            if (this.settings.filters) {
                this.saveFilters();
            }
            this.reset_page();
            this.debounce_emails(true);
        },
        date_filter__gt(val) {
            if (this.settings.filters) {
                this.saveFilters();
            }
            this.reset_page();
            // do not debounce on datestart change ???
            //this.debounce_emails(true);
        },
        date_filter__lt(val) {
            if (this.settings.filters) {
                this.saveFilters();
            }
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
        async loadLocaleMessages () {
            //console.log(lang_files['en.json']);

            if ('fallbackLocaleData' in window.localStorage) {
                this.fallbackLocaleData = JSON.parse(window.localStorage['fallbackLocaleData']);
            } else {
                await $.getJSON("/static/locales/en.json", function(json_data_fallback) {
                    window.localStorage.setItem("fallbackLocaleData", JSON.stringify(json_data_fallback));
                    //return json_data_fallback;
                });
            }
            
            if ('localeData' in window.localStorage) {
                this.localeData = JSON.parse(window.localStorage['localeData']);
            } else {
                await $.getJSON("/static/locales/"+this.settings.locale+".json")
                    .done(function(json_data) {
                        window.localStorage.setItem("localeData", JSON.stringify(json_data));
                        //return json_data;
                    })
                    // set fallback en locale if no current browser locale is supported
                    .fail(function(json_data) {
                        //text = "Current browser "+ window.localStorage['locale'] + " locale is not supported. Falling back to default en locale!";
                        //console.log(text);
                        window.localStorage.setItem("localeData", window.localStorage['fallbackLocaleData']);
                        window.localStorage.setItem("locale", "en");
                        window.localStorage.setItem("falled_back", true);
                    })
            }
        },

        ToggleStickyHeader(thead) {
            /*if (thead == '') {
                thead = $('.tablesorter-sticky-wrapper');
            };*/

            $('.hide-sticky-header-button i').toggleClass('down').toggleClass('up');

            if (parseInt(thead.css('top')) != -320) {
                window.localStorage['sticky_header_visible']=false;
                thead.animate({
                    top: '-320px'
                })
            } else {
                window.localStorage['sticky_header_visible']=true;
                thead.animate({
                    top: '0px'
                })
            }
        },
        /*apply_marquee(found_table,vue) {              
            // do not marquee in mobile mode
            if (window.matchMedia('(min-width: 767px)').matches) {
                found_table.on('resize', function(event, columns) {
                    $(".emails-list td:not(:last-child):not(.exclude-marquee)").unbind().marquee();
                });

                $(".emails-list td:not(:last-child):not(.exclude-marquee), .emails-list th:not(.exclude-marquee)").marquee();
            }
        },*/
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
            //console.log($found_table);
            $found_table.colResizable({
                postbackSafe: true,
                useLocalStorage: true,
                minWidth: 60,
                disabledColumns: [8] // disable last column (button)
            });

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
        // TODO refactor messages based on locale and new functions
        addFilterLink(element) {
            $td = element.find('td');
            if (this.localeData.filters.filter_link_tip == undefined) {
                text = this.fallbackLocaleData.filters.filter_link_tip
            } else {
                text = this.localeData.filters.filter_link_tip
            }
            $td.each(function(i, obj) {
                $th = $(obj).closest('table').find('th').eq($(obj).index());
                if (($th.attr('id') != "size") && (!($th.hasClass("exclude-marquee")))) {
                    $(obj).addClass('filter_linked');
                }
                if ($th.attr('id') == "id") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'id';
                    })
                }
                if ($th.attr('id') == "status") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.status_filter = window.app.returnAllowedString($(obj).text());
                    })
                }
                if ($th.attr('id') == "mail_from") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'mail_from';
                    })
                }   
                if ($th.attr('id') == "mail_to") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        multiple = window.app.returnAllowedString($(obj).text());
                        multiple_check = multiple.indexOf(' and more (check log lines)');
                        if (multiple_check >=0) {
                            multiple = multiple.substr(0, multiple_check);
                        }
                        window.app.search = multiple;
                        window.app.search_by = 'mail_to';
                    })
                }
                if ($th.attr('id') == "subject") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.search = window.app.returnAllowedString($(obj).text());
                        window.app.search_by = 'subject';
                    })
                }
                if ($th.attr('id') == "timestamp") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.date_filter__gt = window.app.returnAllowedString($(obj).text());
                        window.app.date_filter__lt = window.app.returnAllowedString($(obj).text());
                    })
                }
                if ($th.attr('id') == "first_attempt") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.date_filter__gt = window.app.returnAllowedString($(obj).text());
                    })
                }
                if ($th.attr('id') == "last_attempt") {
                    $(obj).find('span').attr('title', text + " «" + $th.text().trim() + "»").on("click", function(){
                        window.app.date_filter__lt = window.app.returnAllowedString($(obj).text());
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

            if (parseInt(thead.css('top')) != -320) {
                $('.hide-sticky-header-button i').removeClass('down').addClass('up');
            } else {
                $('.hide-sticky-header-button i').removeClass('up').addClass('down');
            }
        },
        toggleLoading(state) {
            if (state) {
                this.loading = true;
                $("#main-wrapper").hide();
                $('#loading-modal').modal({closable: false,blurring: this.settings.blurring,inverted: true}).modal('show');
            } else {
                setTimeout(() => $('#loading-modal').modal('hide'), 500);
                //$('#loading-modal').modal('hide');
                setTimeout(() => $("#main-wrapper").show(), 500);
                //$("#main-wrapper").show()
                this.loading = false;
            }
        },
        loadEmails(refresh) {
            // show loading modal on emails load
            if (refresh) {
                $('#main-wrapper').hide(); 
                this.toggleLoading(true);
            }

            var url = base_url, queries = 0;
            var no_results = false;

            // load saved sort
            this.loadSort();

            //console.log("Current filters: "+JSON.stringify(this.email_filter));
            for (var f in this.email_filter) {
                url += (queries === 0) ? '?' : '&';
                url += `${f}=${this.email_filter[f]}`;
                queries += 1;
            }

            url += (queries === 0) ? '?' : '&';
            url += `page=${this.page}&limit=${this.settings.page_limit}`;
            // add sort string
            url += `&order=${this.order}&order_dir=${this.order_dir}`;

            return fetch(url).then(function (response) {
                return response.json();
            }).then((res) => {
                this.emails = res['result'];
                // get format from .env var
                for (let i = 0; i < this.emails.length; i++) {
                    this.emails[i].timestamp = this.format_date(this.emails[i].timestamp,datetime_format,false);
                    this.emails[i].first_attempt = this.format_date(this.emails[i].first_attempt,datetime_format,false);
                    this.emails[i].last_attempt = this.format_date(this.emails[i].last_attempt,datetime_format,false);
                }
                 
                this.page_count = res['total_pages'];
                this.count = res['count'];

                //setTimeout(() => this.toggleLoading(false), 1000);
                this.toggleLoading(false);

                // add advanced gui features
                this.$nextTick(function () {
                    $found_table = $('.emails-list');
                    thead = $found_table.find('thead');
                    // if no results don't show table and show notification
                    if (this.count == 0) {
                        if (this.localeData.notie.nine == undefined) {
                            text = this.fallbackLocaleData.notie.nine
                        } else {
                            text = this.localeData.notie.nine
                        }
                        notie.alert({type: 'info', text: text });
                        $found_table.hide();
                        $('.JCLRgrips').hide();
                    }
                    if (refresh) {
                        // scroll to the table top
                        if ($found_table.find('td:first').length > 0) {
                            // dirty 500 ms waiting of scrollTo complete =(
                            setTimeout(() => {
                                const element = $found_table.find('td:first')[0];
                                const yOffset = -55; 
                                const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                // scrolling offset by hide-sticky-header-button height
                                window.scrollTo({top: y, behavior: 'smooth'});
                            }, 500);

                        }
                    } 
                    // style selected column for sort
                    $found_table.find('#'+this.order).removeClass().addClass(this.order_dir);
                    // if no results don't process empty table
                    if (this.count != 0) {
                        // bind sort to table headers
                        $('.emails-list th:not(.exclude-marquee)').one('click',function(){
                            window.app.callSort(this);
                        });
                        
                        // add sticky table header
                        if (this.settings.sticky) {
                            thead.first().css({'top': 0, 'position':'sticky', 'z-index': 1, 'background':'white' })/*.addClass('sticky-visible')*/;
                            // add show/hide sticky header button 
                            if (window.matchMedia('(max-width: 768px)').matches)
                            {
                                // TODO dirty 500 ms waiting of scrollIntoView complete =(
                                //setTimeout(() => window.app.checkButtonArrow(thead), 500);
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
                            // dirty fix of callResizableTableColumns with 500 ms timeout
                            setTimeout(() => this.callResizableTableColumns($found_table), 500);
                            if (this.localeData.user_settings.resizable_title_tip == undefined) {
                                text = this.fallbackLocaleData.user_settings.resizable_title_tip
                            } else {
                                text = this.localeData.user_settings.resizable_title_tip
                            }
                            thead.find('th:not(.exclude-marquee)').attr('title',text)
                            // reset colResizable() widths states
                            thead.find('th:not(.exclude-marquee)').one( "contextmenu", function() {
                                //console.log("colResizable() widths are reset!");
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

                    // to apply marquee
                    /*if (this.settings.marquee) {
                        this.apply_marquee($found_table, this);
                    }*/
                    // styling of statuses and status filter dropdown
                    if (!$found_table.find('td:nth-child(3)').hasClass('styled')) {
                        $found_table.find('td:nth-child(3):contains("deferred")').addClass('styled').prepend(this.settings.status_icon['deferred']);
                        $found_table.find('td:nth-child(3):contains("sent")').addClass('styled').prepend(this.settings.status_icon['sent']);
                        $found_table.find('td:nth-child(3):contains("reject")').addClass('styled').prepend(this.settings.status_icon['reject']);
                        $found_table.find('td:nth-child(3):contains("bounced")').addClass('styled').prepend(this.settings.status_icon['bounced']);
                        $found_table.find('td:nth-child(3):contains("multiple")').addClass('styled').prepend(this.settings.status_icon['multiple']);
                        $found_table.find('td:nth-child(3):contains("unknown")').addClass('styled').prepend(this.settings.status_icon['unknown']);
                    }
                    if (this.settings.colored) {
                        var filter_email = $('#filter-email');
                        $found_table.find('td:contains("NOFILTER")').closest('tr').css('background-color',this.settings.status_color['NOFILTER']);
                        $('#filter-email option[value="NOFILTER"]').css('background-color',this.settings.status_color['NOFILTER']);
                        $found_table.find('td:contains("deferred")').closest('tr').css('background-color',this.settings.status_color['deferred']);
                        $('#filter-email option[value="deferred"]').css('background-color',this.settings.status_color['deferred']);
                        $found_table.find('td:contains("sent")').closest('tr').css('background-color',this.settings.status_color['sent']);
                        $('#filter-email option[value="sent"]').css('background-color',this.settings.status_color['sent']);
                        $found_table.find('td:contains("reject")').closest('tr').css('background-color',this.settings.status_color['reject']);
                        $('#filter-email option[value="reject"]').css('background-color',this.settings.status_color['reject']);
                        $found_table.find('td:contains("bounced")').closest('tr').css('background-color',this.settings.status_color['bounced']);
                        $('#filter-email option[value="bounced"]').css('background-color',this.settings.status_color['bounced']);
                         $found_table.find('td:contains("multiple")').closest('tr').css('background-color',this.settings.status_color['multiple']);
                        $('#filter-email option[value="multiple"]').css('background-color',this.settings.status_color['multiple']);
                         $found_table.find('td:contains("unknown")').closest('tr').css('background-color',this.settings.status_color['unknown']);
                        $('#filter-email option[value="unknown"]').css('background-color',this.settings.status_color['unknown']);
                        filter_email.css("background-color", filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
                        filter_email.one('change', function () {
                            filter_email.css("background-color", filter_email[0].options[filter_email[0].selectedIndex].style.backgroundColor);
                        }); 
                    }
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
                          //console.log('change: ' + date + "  text: " + text + "  mode: " + mode)
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
                          //console.log('change: ' + date + "  text: " + text + "  mode: " + mode)
                          // fomat date to iso8601
                          window.app.date_filter__lt = text;
                          //$(".ui.popup.left").removeClass("visible").addClass("invisible");
                          //$('#rangestart').calendar('clear');
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
                });

            }).catch((res) => {
                console.error('Error:', res);
            });
        },
        logout() {
            // keep locale settings
            var localeData = localStorage.getItem('localeData');
            var fallbackLocaleData = localStorage.getItem('fallbackLocaleData');
            var locale = localStorage.getItem('locale');
            localStorage.clear();
            localStorage.setItem('localeData',localeData);
            localStorage.setItem('fallbackLocaleData',fallbackLocaleData);
            localStorage.setItem('locale',locale);
            window.location = '/logout';

        },
        show_modal(m) {
            this.msg = m;
            $('#mail-modal').modal({
            onHidden: function () {
                $('body').removeClass('scrolling');
            },
                closable: true,
                inverted: false,
                blurring: this.settings.blurring
            }).modal('show');
            // fix of semantic ui scrolling appear on the many related log lines modals
            $('body').addClass('scrolling');
            // apply styling to modal
            this.$nextTick(function () {
                $('#mail-modal > div.header > span > i').remove();
                $('#mail-modal > div.header > span').prepend(this.settings.status_icon[m.status.code]);
                if (this.settings.colored) {
                    $('#email-metadata td:contains("'+m.status.code+'")').css('background-color',this.settings.status_color[m.status.code].slice(0, -2) + '.4)');
                    $('.ui.modal>.header').css('background-color',this.settings.status_color[m.status.code].slice(0, -2) + '.4)');

                } else {
                    $('#email-metadata td:contains("'+m.status.code+'")').css('background-color',this.settings.status_color['NOFILTER']);
                    $('.ui.modal>.header').css('background-color',this.settings.status_color['NOFILTER']);
                }
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
            window.localStorage['saved_filters.search']=this.search;
            window.localStorage['saved_filters.status_filter']=this.status_filter;
            window.localStorage['saved_filters.search_by']=this.search_by;
            window.localStorage['saved_filters.date_filter__gt']=this.date_filter__gt;
            window.localStorage['saved_filters.date_filter__lt']=this.date_filter__lt;
            //console.log("Filters are saved!");

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
                this.date_filter__gt = window.localStorage['saved_filters.date_filter__gt'];
            }
            if ('saved_filters.date_filter__lt' in window.localStorage) {
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
            this.status_filter = "NOFILTER";
            this.search_by = "id";
            // change start date based on saving filters option?
            if (this.settings.filters) {
                this.date_filter__gt = "";
            } else {
                this.setDuration();
            }
            //this.date_filter__gt = this.setDuration();
            this.date_filter__lt = "";
            $("#filter-email").css('background-color',this.settings.NOFILTER_color);
            //notie.alert({type: 'warning', text: 'All filters are reset successfully'});
            if (this.localeData.notie.four == undefined) {
                text = this.fallbackLocaleData.notie.four
            } else {
                text = this.localeData.notie.four
            }
            notie.alert({type: 'warning', text: text});
            //this.debounce_emails(true);
            this.reset_page();
        },
        saveCurPage() {
            window.localStorage['cur_page']=this.page;
        },
        setDuration() {
            // default start_date default_period minutes ago as gui option
            //var default_period = 10;
            //if ($('#default_period_div input').is(":disabled"))
            this.$nextTick(function () {
                if (this.settings.default_period) {
                    if (!($('#default_period_div input').is(":disabled"))) {
                        //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //timezone offset in milliseconds
                        var startdate = new Date(new Date(Date.now()) - this.settings.default_period * 60000/* - tzoffset*/);
                        startdate = this.format_date(startdate,datetime_format,true);
                        //console.log(startdate);
                        this.date_filter__gt = startdate;
                        this.reset_page();
                    }
                };
            });
        },
        loadCurPage() {
            if ('cur_page' in window.localStorage) {
                this.page = Number.parseInt(window.localStorage['cur_page']);
            }
        },
        onSettingsUpdated(val) {
            let v = JSON.parse(JSON.stringify(val));
            v.page_limit = Number.parseInt(v.page_limit);
            v.default_period = Number.parseInt(v.default_period);
            let updatePage = (v.default_period !== Number.parseInt(this.settings.default_period) || v.page_limit !== Number.parseInt(this.settings.page_limit) /*|| v.marquee !== this.settings.marquee*/ || v.colored !== this.settings.colored || v.sticky !== this.settings.sticky || v.resizable !== this.settings.resizable || v.locale !== this.settings.locale);
            
            let reload = false;

            // if locale has changed we need to remove localeData from localStorage
            if ((this.settings.locale !== window.localStorage['locale']) && (this.settings.locale !== undefined)) {
                window.localStorage.removeItem('localeData');
                // load current locale data
                this.settings.locale = v.locale;
                this.loadLocaleMessages();
                reload = true;
            }


            this.settings = v;
            this.loaded_settings = true;

            if (updatePage) {

                this.setDuration();
                if (reload) {
                    //location.reload();
                    // dirty timeout to show notie
                    setTimeout(() => location.reload(), 500);
                } else {
                    this.debounce_emails(true);
                }
                //location.reload();

            }
            // notie.alert('success', `User settings ${update_type} successfully`)
        },

    },
    mounted() {

        //TODO need to fix dropdown update
        //$('select.dropdown').addClass("menu");
        //$('select.dropdown ').addClass("dropdown ui");

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

        /*if (this.loadLocaleMessages() == "falledback") {
            console.log("Current browser "+ window.localStorage['locale'] + " locale is not supported. Falling back to default en locale!")
        };*/

        $('select.dropdown option').addClass("item");  
        // check setDuration option set
        this.setDuration();

        // load saved filters
        if (this.settings.filters) {
            this.loadFilters();
        }
        // check if we are on login or api_error screen
        if ((($("div.logo.login").length > 0) || ($(".api_error_container").length > 0)) && (localStorage.getItem("fallbackLocaleData")=== null))  {
            // dirty way with timeout =( 
            setTimeout(() => location.reload(), 1000);
        } else {
            if (($("div.logo.login").length > 0) || ($(".api_error_container").length > 0)) {
                this.toggleLoading(false);
            }
        }

        this.$nextTick(function () {
            // if cur browser is mozilla turn off marquee function dirty with timeout
            /*if (navigator.userAgent.search("Firefox") > -1) {
                setTimeout(() => $('#marquee_sw input').prop('disabled', true), 1000);
            }*/
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
            //focus on password input
            $("#login input").focus();

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
        });
    }
});