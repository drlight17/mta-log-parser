// append path_prefix to the base_url if any is set
const path_prefix = document.currentScript.getAttribute('path_prefix');
const base_url = path_prefix + '/api/emails';
const base_url2 = path_prefix + '/api/auth';
const base_url3 = path_prefix + '/api/stats';
// get datetime_format from .env
var datetime_format = document.currentScript.getAttribute('datetime_format');
if (datetime_format == '') {
        datetime_format = 'YYYY-MM-DDTHH:mm:ss.sssZ';
}
// get mail_domain from .env
var mail_domain = document.currentScript.getAttribute('mail_domain');

// get current mlp version from .env
var parser_version = document.currentScript.getAttribute('parser_version');

// get current mlp version from .env
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
            hidden_settips: true,
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
            filters_changed: false
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
            //console.log("Fired!")
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
    	// bind arrow keys for modal left and right buttons
		arrowKeyBind(modal) {
			document.onkeydown = function(e) {
			    switch(e.which) {
			        case 37: // left
					if (window.app.index <= 0) {
			        	$('.prev_email').blur();
			        } else {
			        	$('.prev_email').focus();
			    	}
			        break;

			        case 39: // right
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
			modal.addEventListener('touchstart', e => {
			  touchstartX = e.changedTouches[0].screenX
			})

			modal.addEventListener('touchend', e => {
			  touchendX = e.changedTouches[0].screenX
			  window.app.checkDirection();
			})
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
        menu_vertical_switch() {
            if (window.matchMedia('(max-width: 767px)').matches) {
                this.vertical_menu = true;
            } else {
                this.vertical_menu = false;
            }
        },
        // detect swipe direction
        checkDirection() {
		  if (touchendX < touchstartX) {
		  	//console.log('swiped left!');
			if (window.app.index >= window.app.msg_length-1) {
	        	$('.next_email').blur();
	        } else {
	        	$('.next_email').focus().click();
	    	}
		  } 
		  if (touchendX > touchstartX) {
		  	//console.log('swiped right!');
			if (window.app.index <= 0) {
	        	$('.prev_email').blur();
	        } else {
	        	$('.prev_email').focus().click();;
	    	}
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
        toggleHide(object) {
            $(object).transition({
            	animation : "fade down",
            	onHidden: function () {
                    if (object == '.settips') {
    					window.localStorage.setItem("hidden_settings_tips", true);
                        window.app.hidden_settips = true;
                    }
                    if (object == '#charts-wrapper') {
                        window.localStorage.setItem("hidden_stats", true);
                        window.app.hidden_stats = true;
                        $(window.app.$refs.statsRef.stop_draws());

                    }
                    
                    //$('#current_user').show();
				},
				onVisible: function () {
                    if (object == '.settips') {
    					window.localStorage.setItem("hidden_settings_tips", false);
                        window.app.hidden_settips = false;
                    }
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
        multiple_localize(object) {
            //console.log("Rewrite multiple status and message");
            multiple_check = object.text().indexOf(' and more');
            if (this.localeData.emails_list.multiple == undefined) {
                text1 = this.fallbackLocaleData.emails_list.multiple
            } else {
                text1 = this.localeData.emails_list.multiple
            }
            if (multiple_check >=0) {
            	str_to_localize = object.text().substr(multiple_check, object.text().length);
            	localized_str = object.text().replace(str_to_localize, text1);
            	object.text(localized_str);
            }
            return text1;

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
                    search_str = window.app.multiple_localize(object);

                    object.attr('title', text + " «" + $th.text().trim() + "»").on("click", function(e){
                        multiple = window.app.returnAllowedString($(obj).text());
                        multiple_check = $(obj).text().indexOf(search_str);
                        if (multiple_check >= 0) {
                            multiple = multiple.substr(0, multiple_check);
                        }
                        window.app.search = multiple;
                        window.app.search_by = 'mail_to';
                        e.stopPropagation();
                        window.app.debounce_emails(true);
                    })
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
                this.loading = true;
                $("#main-wrapper").hide();
                var isDark = (window.localStorage['dark'] === 'true');
                $('#loading-modal').modal({closable: false,blurring: this.settings.blurring,inverted: !isDark}).modal('show');
            } else {
                $('#loading-modal').modal('hide');
                $("#main-wrapper").show()
                this.loading = false;
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
        loadEmails(refresh) {

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
    	                    this.emails[i].timestamp = this.format_date(this.emails[i].timestamp,datetime_format,false);
    	                    this.emails[i].first_attempt = this.format_date(this.emails[i].first_attempt,datetime_format,false);
    	                    this.emails[i].last_attempt = this.format_date(this.emails[i].last_attempt,datetime_format,false);
    	                }

    	                this.page_count = res['total_pages'];
    	                this.count = res['count'];
                        console.log(this.page_count)

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
    	                            if (window.matchMedia('(max-width: 767px)').matches)
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
    	                        $found_table.find('td:nth-child(3):contains("deferred")').addClass('styled').prepend(this.settings.status_icon['deferred']);
    	                        $found_table.find('td:nth-child(3):contains("sent")').addClass('styled').prepend(this.settings.status_icon['sent']);
    	                        $found_table.find('td:nth-child(3):contains("reject")').addClass('styled').prepend(this.settings.status_icon['reject']);
    	                        $found_table.find('td:nth-child(3):contains("bounced")').addClass('styled').prepend(this.settings.status_icon['bounced']);
    	                        $found_table.find('td:nth-child(3):contains("multiple")').addClass('styled').prepend(this.settings.status_icon['multiple']);
    	                        $found_table.find('td:nth-child(3):contains("unknown")').addClass('styled').prepend(this.settings.status_icon['unknown']);
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
            
            //console.log(element);
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
                    $('body').removeClass('scrolling');
                },
                    closable: true,
                    inverted: false,
                    blurring: this.settings.blurring
                }).modal('show');
            window.app.validation(false);
        },
        show_modal(m,index,key) {
            this.msg = m[index];
            this.index = index;
            this.msg_length = m.length;

            $('#mail-modal').modal({
            onHidden: function () {
                $('body').removeClass('scrolling');
                window.app.arrowKeyUnBind();
            },
            onVisible: function () {
            	window.app.arrowKeyBind($(this)[0]);
                window.app.swipeBind($(this)[0]);
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
                $('#mail-modal > div.header > span').prepend(this.settings.status_icon[m[index].status.code]);
                // TLS encryption logo and title
                if ($('#mail-modal > div.content > ul').text().indexOf("TLS") >=0 ) {
                    if (this.localeData.emails_list.status_tls == undefined) {
                        text = this.fallbackLocaleData.emails_list.status_tls
                    } else {
                        text = this.localeData.emails_list.status_tls
                    }
                    $('#mail-modal > div.header > span').prepend(" ").prepend(this.settings.status_icon["tls"]).attr('title', text);
                } else {
                    if (this.localeData.emails_list.status_notls == undefined) {
                        text = this.fallbackLocaleData.emails_list.status_notls
                    } else {
                        text = this.localeData.emails_list.status_notls
                    }
                    $('#mail-modal > div.header > span').prepend(" ").prepend(this.settings.status_icon["no_tls"]).attr('title', text);
                }
                // localize status message and mail_to for multiple
                window.app.multiple_localize($('#email-metadata td:contains("and more")'));
                window.app.multiple_status_localize($('#email-metadata code'));

                if (this.settings.colored) {
                    var brightness = 0;
                    if (this.settings.dark) {
                        brightness = -40;
                    }
                    $('#email-metadata td:contains("'+m[index].status.code+'")').css('background-color',this.shadeColor(this.settings.status_color[m[index].status.code],brightness));
                    $('.ui.modal>.header').css('background-color',this.shadeColor(this.settings.status_color[m[index].status.code],brightness));


                } else {
                    // change to inherit due to dark mode changes
                    $('#email-metadata td:contains("'+m[index].status.code+'")').css('background-color','inherit');
                    $('.ui.modal>.header').css('background-color','inherit');
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
                    //var tzoffset = (new Date()).getTimezoneOffset() * 60000; //timezone offset in milliseconds
                    var startdate = new Date(new Date(Date.now()) - this.settings.default_period * 60000/* - tzoffset*/);
                    startdate = this.format_date(startdate,datetime_format,true);
                    //console.log(startdate);
                    this.date_filter__gt = startdate;
                }
            });
        },
        countdown (time) {
          // Update every second
            clearInterval(this.contdown_timer);
            if (time >= 1) {
                this.contdown_timer = setInterval(function() {
                    window.app.contdown_sec = --time;
                    window.app.contdown = window.app.ConvertSeconds(window.app.contdown_sec,true);
                }, 1000);
            }
        },
        setRefresh() {
            // autorefresh
            this.$nextTick(function () {
                clearInterval(window.app.timer);
                // hide rotation animation after 1s
                setTimeout(() => $('#navi .sync.icon').removeClass('rotate'), 1000);
                if (window.app.settings.refresh > 0) {
                    window.app.contdown_sec = window.app.settings.refresh * 60;
                    window.app.timer = setInterval(function(){
                        if (window.app.settings.refresh !== undefined) {
                        	// show rotation animation
                        	$('#navi .sync.icon').addClass('rotate');
                            window.app.loadEmails(false);
                        }
                    }, window.app.settings.refresh * 60000);
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
            let updatePage = (v.default_period !== Number.parseInt(this.settings.default_period) || v.page_limit !== Number.parseInt(this.settings.page_limit) || v.refresh !== Number.parseInt(this.settings.refresh) /*|| v.marquee !== this.settings.marquee*/ || v.dark !== this.settings.dark || v.colored !== this.settings.colored || v.sticky !== this.settings.sticky || v.resizable !== this.settings.resizable || v.locale !== this.settings.locale || v.filters !== this.settings.filters);
            
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
                    // show loading modal before reload
                    this.toggleLoading(true);
                    location.reload();
                } else {
                    this.debounce_emails(true);
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
                    if (parser_version != response["tag_name"].substring(1)) {
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
                if (parser_version != this.getCookie('mlp_latest_version')) {
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

            if (this.search) {
                link += 'search='+this.search
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

        // menu vertical-horizontal toggle
        this.menu_vertical_switch();
        window.addEventListener('resize', this.menu_vertical_switch);

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

	        // check hidden tips and settings

	        if ((localStorage.getItem("hidden_settings_tips") === null) || (localStorage.getItem("hidden_settings_tips") === 'false'))  {
	        	$('.settips').show();
	        	this.hidden_settips = false;
	        } else {
	        	$('.settips').hide();
	        	this.hidden_settips = true;
	        }

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
    }
});
