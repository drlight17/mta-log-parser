    app.component('stats', {
        template: `
        <div id="charts-wrapper" class="ui segment stackable two column grid">
            <div class="three wide column">
                <h3 id="overall_pie_title"><i class="calendar outline icon"></i><i class="chart pie icon"></i><span :title="$parent.localeData.overall_pie_title" v-if="$parent.localeData.overall_pie" v-html="$parent.localeData.overall_pie"></span><span v-else :title="$parent.localeData.overall_pie_title" v-html="$parent.fallbackLocaleData.overall_pie"></span><i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="overall_pie stats_refresh sync icon"></i></h3>
                <div class="ui form">
                    <canvas v-if="!loading_overall_pie" id="overall_pie"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

            <div class="three wide column">
                <h3><i class="filter icon"></i><i class="chart pie icon"></i><span v-if="$parent.localeData.filtered_pie" v-html="$parent.localeData.filtered_pie"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_pie"></span><i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="filtered_pie stats_refresh sync icon"></i></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_pie" id="filtered_pie"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

            <div class="ten wide column">
                <h3 class="top">
                    <div v-if="hidden_indicator_filtered_top_senders" class="ui looping pulsating" :class="{ transition: hidden_indicator_filtered_top_senders }" v-bind:data-tooltip="$parent.localeData.hidden_indicator" data-position="top left" :data-inverted="$parent.settings.dark ? true : null">
                        <i class="chart bar icon"></i>
                        <span v-if="$parent.localeData.filtered_top_senders" v-html="$parent.localeData.filtered_top_senders"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.filtered_top_senders"></span>
                    </div>
                    <div v-else>
                        <i class="chart bar icon"></i>
                        <span v-if="$parent.localeData.filtered_top_senders" v-html="$parent.localeData.filtered_top_senders"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.filtered_top_senders"></span>
                    </div>
                    <i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="filtered_top_senders stats_refresh sync icon"></i>
                </h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_senders" id="filtered_top_senders">
                    </canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                    <div class="ui menu item contextMenu" :class="{ inverted: $parent.settings.dark }" id="contextMenu_filtered_top_senders" >
                    </div>
                </div>
                <h3 class="top">
                    <div v-if="hidden_indicator_filtered_top_recipients" class="ui looping pulsating" :class="{ transition: hidden_indicator_filtered_top_recipients }" v-bind:data-tooltip="$parent.localeData.hidden_indicator" data-position="top left" :data-inverted="$parent.settings.dark ? true : null">
                        <i class="chart bar icon"></i>
                        <span v-if="$parent.localeData.filtered_top_recipients" v-html="$parent.localeData.filtered_top_recipients"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.filtered_top_recipients"></span>
                    </div>
                    <div v-else>
                        <i class="chart bar icon"></i>
                        <span v-if="$parent.localeData.filtered_top_recipients" v-html="$parent.localeData.filtered_top_recipients"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.filtered_top_recipients"></span>
                    </div>
                    <i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="filtered_top_recipients stats_refresh sync icon"></i>
                </h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_recipients" id="filtered_top_recipients">
                    </canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                    <div class="ui menu item contextMenu" :class="{ inverted: $parent.settings.dark }" id="contextMenu_filtered_top_recipients" >
                    </div>
                    
                </div>
            </div>

        </div>`,
        data() {
            return {
                array_overall: {},
                watermark_timestamp: '',
                array_filtered: {},
                array_filtered_top_senders: [],
                array_filtered_top_recipients: {},
                loading_overall_pie: false,
                loading_filtered_pie: false,
                loading_filtered_top_senders: false,
                loading_filtered_top_recipients: false,
                hidden_indicator_filtered_top_recipients: false,
                hidden_indicator_filtered_top_senders: false,
                //loading_filtered_throughoutput: false,
                noData_plugin: {
                  id: 'noData',
                  afterDatasetsDraw(chart, args, options) {
	                const {datasets} = chart.data;
	                const {color, text_color, bg_color, width, radiusDecrease} = options;
	                let hasData = false;

	                for (let i = 0; i < datasets.length; i += 1) {
	                  const dataset = datasets[i];
	                  for (let j = 0; j < dataset.data.length; j += 1) {
	                    hasData |= (dataset.data[j] != 0 && typeof dataset.data[j] !== 'undefined' );
	                  }
	                }

	               
                     const {chartArea: {left, top, right, bottom}, ctx} = chart;
                     const centerX = (left + right) / 2;
                     const centerY = (top + bottom) / 2;
                     const r = Math.min(right - left, bottom - top) / 2;

                     if (!hasData) {
	                  ctx.beginPath();
	                  ctx.lineWidth = width || 2;
	                  ctx.strokeStyle = color;
	                  ctx.globalCompositeOperation='destination-over'; // reverse z-index of canvas drawing
	                  if (chart.config._config.type == 'doughnut') {
	                  	ctx.arc(centerX, centerY, (r - radiusDecrease || 0), 0, 2 * Math.PI);
	                  	fontSize = (chart.height / 200).toFixed(2);
	                  } else {
						fontSize = (chart.height / 110).toFixed(2);
	                  }

	                  ctx.textAlign = 'center';
	                  ctx.textBaseline = 'top';
	                  ctx.font = fontSize + "rem Arial";
	                  var text_width = ctx.measureText(stats_app.$parent.localeData.no_data).width;
	                  //text color
	                  ctx.fillStyle = text_color;
	                  ctx.fillText(stats_app.$parent.localeData.no_data, chart.width / 2, chart.height / 2);
	                  // background color
	                  ctx.fillStyle = bg_color;
	                  ctx.fillRect(chart.width / 2 - text_width / 2, chart.height / 2 - ( fontSize * 1.5) / 2, text_width, parseInt(ctx.font, 10));

	                  ctx.stroke();
	                } else {
                        text_width = ctx.measureText(stats_app.$parent.localeData.cached + " " + timestamp).width;
                        // add watermarked current timestamp

                        if (chart.config._config.type == 'doughnut') {
                            stats_app.$parent.is_mobile ? fontSize = (chart.height / 300).toFixed(2) : fontSize = (chart.height / 400).toFixed(2);
                            ch_height = chart.height/1.3
                            //ch_width = chart.width / 2
                            ch_width = chart.width / 2 - text_width / 2
                            //ctx.textAlign = 'center';
                        } else {

                            stats_app.$parent.is_mobile ? fontSize = (chart.height / 300).toFixed(2) : fontSize = (chart.height / 200).toFixed(2)

                            ch_height = chart.height / 2.5
                            ch_width = chart.width / 1.5 - text_width / 2
                            //ctx.textAlign = 'left';
                        }
                        ctx.globalAlpha = .7;
                        ctx.textBaseline = 'top';
                        ctx.font = fontSize + "rem Arial";


                        // check cookie ..._created existence
                        if (typeof(stats_app.$parent.getCookie(chart.canvas.id+"_created")) !== 'undefined') {
                            timestamp = stats_app.$parent.format_date(stats_app.$parent.getCookie(chart.canvas.id+"_created"),datetime_format,false);
                            // background color
                            ctx.fillStyle = bg_color;
                            ctx.fillRect(ch_width, ch_height, text_width, parseInt(ctx.font, 10));
                            ctx.fillStyle = text_color;
                            ctx.fillText(stats_app.$parent.localeData.cached + " " + timestamp, ch_width, ch_height);
                            ctx.closePath();
                            ctx.globalAlpha = 1;
                        } else {
                            // force refresh graph
                             stats_app.force_refresh(chart.canvas.id);
                        }
                    }
              	  },
                }
            }
        },
        props: {
        },
        computed: {
        },
        watch: {
        },
        methods: {
        	create_donut (chart_type, view_data, bgd_color, text_color) {
                /*if (window.matchMedia('(max-device-width: 767px)').matches) {
                    is_mobile = true;
                } else {
                    is_mobile = false;
                }*/
                this.$nextTick(function () {
        			const ctx = document.getElementById(chart_type);
                    // try to destroy before create
                    this.stop_draws(chart_type);
                    let chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: view_data,
                        plugins: [stats_app.noData_plugin],
                        options: {
                            plugins: {
                                noData: {
                                    color: 'rgba(128, 128, 128, 0.3)',
                                    text_color: text_color,
                                    bg_color: bgd_color,
                                    width: 40,
                                    radiusDecrease: 20
                                },
                                legend: {
                                    onHover: (e, element) => {
                                        e.native.target.style.cursor = element[0] ? 'pointer' : 'default'
                                    },
                                    labels: {
                                        filter: (legendItem, data) => (
                                            data.datasets[0].data[legendItem.index] != 0 && typeof data.datasets[0].data[legendItem.index] !== 'undefined'
                                        ),
                                        color: text_color,
                                        font: {
                                            size: 15
                                        },
                                        /*generateLabels: (chart) => {
                                            const datasets = chart.data.datasets;
                                            //console.log(chart.data.labels_orig);

                                            //labels.push(this.$parent.status_localize(item,1))

                                            return datasets[0].data.map((data, i) => ({
                                                //text: this.$parent.status_localize(data.datasets[0].data[legendItem.index],1)
                                                //text: this.$parent.status_localize('sent',1)
                                                //text: `${chart.data.labels[i]} ${data}`,
                                                text: `${chart.data.labels[i]}`,
                                                fillStyle: datasets[0].backgroundColor[i],
                                                index: i
                                            }))
                                        }*/
                                    }
                                },
                            },
                            responsive: true,
                            maintainAspectRatio: this.$parent.is_mobile,
                            //maintainAspectRatio: false,
                            onHover: (event, chartElement) => {
                                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'
                            },
                            onClick: (e, element) => {
                              const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, true);
                              if (elements.length) {
                                //this.$parent.status_filter = chart.data.labels[elements[0].index]
                                // send original labels instead of processed
                                this.$parent.status_filter = chart.data.labels_orig[element[0].index]
                              }
                            },
                        }
                    });
                })
            },

            create_chart(chart_type, view_data, bgd_color, text_color) {
                /*if (window.matchMedia('(max-device-width: 767px)').matches) {
                    is_mobile = true;
                } else {
                    is_mobile = false;
                }*/

                this.$nextTick(function () {
    				const ctx = document.getElementById(chart_type);
                    this.stop_draws(chart_type);
                    let chart = new Chart(ctx, {
                        type: 'bar',
                        data: view_data,
                        plugins: [
                            stats_app.noData_plugin,
                            {   
                                afterRender: (chart) =>
                                {
                                    stats_app.add_hidden_indicator(chart_type);
                                },
                                afterInit: (chart) =>
                                {
                                    var menu = document.getElementById("contextMenu"+"_"+chart_type);

                                    chart.ctx.canvas.addEventListener('contextmenu', handleContextMenu, false);
                                    chart.ctx.canvas.addEventListener('mousedown', handleMouseDown, false);
                                    // for mobile view touch context menu
                                    chart.ctx.canvas.addEventListener('touchstart', handleMouseDown, false);
                                    //chart.ctx.canvas.addEventListener('touchcancel', handleMouseDown, false);


                                    function handleContextMenu(e){
                                        e.preventDefault();
                                        e.stopPropagation();

                                        var excluded = stats_app.get_excluded(chart_type);
                                        //offset = e.target.width - e.layerX
                                        offset = e.target.scrollWidth - e.layerX
                                        //menu.style.left = e.layerX + "px";
                                        //menu.style.right = 0 + "px";
                                        //menu.style.right = 0

                                        //!(window.matchMedia('(max-device-width: 900px)').matches) ? menu.style.right = offset + "px" : menu.style.right = 0;

                                        menu.style.right = offset + "px"
                                        menu.style.top = e.layerY + "px";

                                        if (typeof excluded !== 'undefined' && excluded.length > 0) {
                                            //menu.style.display = "flex";
                                            $(menu).addClass('animate');


                                            let li2 = document.createElement('span');
                                            li2.classList.add("menu-item-nonhover");
                                            li2.innerHTML = '<u>'+stats_app.$parent.localeData.excluded+'</u>';

                                            let icon_remove = document.createElement('i');
                                            icon_remove.classList.add("trash");
                                            icon_remove.classList.add("alternate");
                                            icon_remove.classList.add("icon");
                                            icon_remove.setAttribute('title',stats_app.$parent.localeData.remove_all_excluded);
                                            li2.append(icon_remove);
                                            $(menu).append(li2);
                                            
                                            icon_remove.addEventListener('click', () => {
                                                    stats_app.remove_all_excluded(chart_type);
                                                    $(menu).removeClass('animate');
                                                    //menu.style.display = "none";
                                                }, { once: true });

                                            for (const element of excluded) {
                                                let li3 = document.createElement('span');
                                                let icon = document.createElement('i');
                                                icon.classList.add("eye");
                                                icon.classList.add("icon");
                                                li3.classList.add("menu-item");
                                                
                                                li3.setAttribute('title',stats_app.$parent.localeData.remove_excluded);
                                                if ((element == '') || (element == '<>')) {
                                                    li3.textContent += stats_app.$parent.localeData.filters.status_filter_unknown;
                                                } else {
                                                    li3.textContent += element;
                                                }
                                                
                                                li3.prepend(icon);
                                                $(menu).append(li3);

                                                // add event listener on every element
                                                li3.addEventListener('click', () => {
                                                    stats_app.remove_from_excluded(element,chart_type);
                                                    //menu.style.display = "none";
                                                    $(menu).removeClass('animate');
                                                }, { once: true });
                                            }
                                            
                                            if (typeof chart.hoveredItem !== 'undefined' ) {
                                                let line= document.createElement('hr');
                                                $(menu).prepend(line);
                                            }


                                        }

                                        if (typeof chart.hoveredItem !== 'undefined' ) {
                                            //menu.style.display = "flex";
                                            $(menu).addClass('animate');
                                            selected = chart.hoveredItem;
                                            let li = document.createElement('span');
                                            
                                            li.classList.add("menu-item");
                                            

                                            let icon_hide = document.createElement('i');
                                            icon_hide.classList.add("eye");
                                            icon_hide.classList.add("slash");
                                            icon_hide.classList.add("icon");

                                            li.setAttribute('title',stats_app.$parent.localeData.exclude);
                                            li.textContent += ' '+selected.data;
                                            li.prepend(icon_hide);

                                            $(menu).prepend(li);
                                            
                                            menu.firstElementChild.addEventListener('click', () => {
                                                stats_app.exclude_selected(selected,chart_type);
                                                //menu.style.display = "none";
                                                $(menu).removeClass('animate');
                                            }, { once: true });

                                            //return(false);
                                        }

                                        let icon_close = document.createElement('i');
                                        $(icon_close).addClass("close large icon link");

                                        icon_close.addEventListener('click', () => {
                                            //stats_app.remove_all_excluded(chart_type);
                                            //menu.style.display = "none";
                                            $(menu).removeClass('animate');
                                            $(menu).empty();
                                        }, { once: true });

                                        $(menu).prepend(icon_close)

                                        return(false);
                                    }

                                    function handleMouseDown(e){
                                        //menu.style.display = "none";
                                        $(menu).removeClass('animate');
                                        $(menu).empty();
                                    }
                                },
                            }
                        ],
                        options: {
                            //barPercentage: 2,
                            indexAxis: 'y',
                            plugins: {
                            	noData: {
                                        color: 'rgba(128, 128, 128, 0.3)',
                                        text_color: text_color,
                                        bg_color: bgd_color,
                                        width: 40,
                                        radiusDecrease: 20
                                    },
                                legend: {
                                  display: false
                                }
                            },
                            scales: {
                                x: {
                                 ticks: {
                                    stepSize: 1,
                                    fontColor: text_color,
                                    backdropColor: text_color,
                                    color: text_color,
                                    font: {
                                            size: 15
                                        }
                                    },
                                },
                                y: {
                                 ticks: {
                                    fontColor: text_color,
                                    backdropColor: text_color,
                                    color: text_color,
                                    font: {
                                            size: 15
                                        }
                                    }
                                 }
                            },
                            //events: ["click", "mousemove"],
                            responsive: true,
                            // true for mobile view
                            //maintainAspectRatio: this.$parent.is_mobile,
                            maintainAspectRatio: false,
                            onHover: (e, element) => {
                                delete chart.hoveredItem;
                                e.native.target.style.cursor = element[0] ? 'pointer' : 'default';
                                const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, true);
                                if (elements.length) {
                                    chart.hoveredItem = { 'index': elements[0].index, 'data': chart.data.labels[elements[0].index] };
                                }
                            },
                            onClick: (e, element) => {
                              const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, true);
                              if (elements.length) {
                                if (chart.ctx.canvas.id == "filtered_top_senders") {
                                    if (chart.data.labels[elements[0].index] != stats_app.$parent.localeData.filters.status_filter_unknown) {
                                        this.$parent.search_by = 'mail_from';
                                        this.$parent.search = chart.data.labels[elements[0].index]
                                    }
                                    // debounce if no text validation errors
                                    stats_app.$nextTick(function () {
                                        stats_app.$parent.check_button();
                                    })
                                }
                                if (chart.ctx.canvas.id == "filtered_top_recipients") {
                                    if (chart.data.labels[elements[0].index] != stats_app.$parent.localeData.filters.status_filter_unknown) {
                                        this.$parent.search_by = 'mail_to';
                                        this.$parent.search = chart.data.labels[elements[0].index]
                                    }
                                    // debounce if no text validation errors
                                    stats_app.$nextTick(function () {
                                        stats_app.$parent.check_button();
                                    })
                                }
                              }
                            },
                        }
                	});
                });
            },
            dynamicColors() {
                var r = Math.floor(Math.random() * 255);
                var g = Math.floor(Math.random() * 255);
                var b = Math.floor(Math.random() * 255);
                return "rgba(" + r + "," + g + "," + b + ", 0.5)";
            },
            poolColors(a) {
                var pool = [];
                for(i = 0; i < a; i++) {
                    pool.push(this.dynamicColors());
                }
                return pool;
            },
            async draw_chart(chart_type,mode) {
                this.toggle_loading_circle(chart_type,true);
                //if (mode == 1) {
                    // check cache in cookie with expiration
                    if ((this.$parent.getCookie(chart_type)) && (this.$parent.getCookie(chart_type) !== '{}')) {
                    //if ((this.$parent.getCookie(chart_type))/* && (this.$parent.getCookie(chart_type) !== '{}'*/) {
                        // get cached data from cookie
                        data = JSON.parse(this.$parent.getCookie(chart_type));
                        //this.watermark_timestamp = JSON.parse(this.$parent.getCookie(chart_type+'_created'));
                        this.check_filters_changes(chart_type);
                    } else {
                        try {
                            if (chart_type == 'filtered_top_senders') {
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_chart(chart_type,0);
                                    return 0;
                                } else {
                                    this.toggle_loading_circle(chart_type,false);
                                    data = 'error'
                                    //return 0;
                                }
                            }
                            if (chart_type == 'filtered_top_recipients') {
                                //this.loading_filtered_top_recipients = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_chart(chart_type,0);
                                    return 0;
                                } else {
                                    this.toggle_loading_circle(chart_type,false);
                                    data = 'error'
                                    //return 0;
                                }
                            }


                        } catch (err) {
                            console.error('Error:', err);
                            return 0;
                        }
                    }
                //}

                var brightness = 0;
                var text_color = "black";
                var bgd_color = "white"
                if (this.$parent.settings.dark) {
                    brightness = -40;
                    text_color = "white";
                    bgd_color = "#2b2b2b"
                }

                var dataset = []
                var labels = []

                if (chart_type == 'filtered_top_senders') {
                    if (data !== 'error') {
                        data.forEach((item, index) => {
                              dataset.push(item['count'])
                              if ((item['mail_from'] !== '')&&(item['mail_from'] !== '<>')) {
                                labels.push(item['mail_from'])
                              } else {

                                labels.push(stats_app.$parent.localeData.filters.status_filter_unknown)
                              }
                        })
                    } else {
                        if (!(this.array_filtered_top_senders.error)) {
    	                    this.array_filtered_top_senders.forEach((item, index) => {
    	                      dataset.push(item['count'])
    	                      if ((item['mail_from'] !== '')&&(item['mail_from'] !== '<>')) {
                                labels.push(item['mail_from'])
                              } else {
                                labels.push(stats_app.$parent.localeData.filters.status_filter_unknown)
                              }
    	                    })
    	                }
                    }
                }

                if (chart_type == 'filtered_top_recipients') {
                    if (data !== 'error') {
                        data.forEach((item, index) => {
                              dataset.push(item['count'])
                              if (item['mail_to'] !== '') {
                                labels.push(item['mail_to'])
                              } else {
                                labels.push(stats_app.$parent.localeData.filters.status_filter_unknown)
                              }
                        })
                    } else {
                        if (!(this.array_filtered_top_recipients.error)) {
    	                    this.array_filtered_top_recipients.forEach((item, index) => {
    	                      dataset.push(item['count'])
    	                      if (item['mail_to'] !== '') {
                                labels.push(item['mail_to'])
                              } else {
                                labels.push(stats_app.$parent.localeData.filters.status_filter_unknown)
                              }
    	                    })
    	                }
                    }
                }
                // 
                var view_data = {
                  labels: labels,
                  datasets: [{
                    //barThickness: 50,
                    //borderSkipped: false,
                    //borderRadius: 10,
                    categoryPercentage: 1,
                    //barPercentage: 0.1,
                    indexAxis: 'y',
                    data: dataset,
                    fill: false,
                    backgroundColor: stats_app.poolColors(dataset.length),
                    borderColor: 'rgba(128, 128, 128, 0.3)',
                    borderWidth: 1
                  }]
                };

                //this.$nextTick(function () {
                    this.toggle_loading_circle(chart_type,false);
                    stats_app.create_chart(chart_type, view_data, bgd_color, text_color)
                //});
            },
            async draw_donut(chart_type,mode) {
                this.toggle_loading_circle(chart_type,true);
                //if (mode == 1) {
                    // check cache in cookie with expiration
                    if ((this.$parent.getCookie(chart_type))/* && (this.$parent.getCookie(chart_type) !== '{}'*/) {
                        // get cached data from cookie
                        data = JSON.parse(this.$parent.getCookie(chart_type));
                        this.check_filters_changes(chart_type);

                    } else {
                        try {
                            if (chart_type == 'overall_pie') {
                                //this.loading_overall_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    //data = this.array_overall
                                    this.draw_donut(chart_type,1);
                                    //return 0;
                                } else {
                                    //this.loading_overall_pie = false;
                                    this.toggle_loading_circle(chart_type,false);
                                    data = "error"
                                    //return 0;
                                }
                            }
                            if (chart_type == 'filtered_pie') {
                                //this.loading_filtered_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    //data = this.array_filtered
                                    this.draw_donut(chart_type,0);
                                    //return 0;
                                } else {
                                    //this.loading_filtered_pie = false;
                                    this.toggle_loading_circle(chart_type,false)
                                    data = "error"
                                    //return 0;
                                }
                            }


                        } catch (err) {
                            console.error('Error:', err);
                            return 0;
                        }    
                    }
                /* }else {
                    this.loading_filtered_pie = false;
                    data = this.array_filtered;
                }*/
                var brightness = 0;
                var text_color = "black";
                var bgd_color = "white"
                if (this.$parent.settings.dark) {
                    brightness = -40;
                    text_color = "white";
                    bgd_color = "#2b2b2b"
                }

                if (data !== 'error') {
                    var dataset = [data['sent'], data['deferred'], data['reject'], data['bounced'], data['unknown'], data['multiple']]
                } else {
                    var dataset = '';
                }
                
                // localize of status labels
                var labels = [];
                labels_orig = ['sent', 'deferred', 'reject', 'bounced', 'unknown', 'multiple'];

                labels_orig.forEach((item, index) => {
                    labels.push(this.$parent.status_localize(item,1))
                })

                var view_data = {
                    labels_orig: labels_orig,
                    labels: labels,
                    datasets: [{
                        data: dataset,
                        backgroundColor: [
                            this.$parent.shadeColor(this.$parent.settings.status_color['sent'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['deferred'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['reject'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['bounced'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['unknown'], brightness),
                            this.$parent.shadeColor(this.$parent.settings.status_color['multiple'], brightness)
                        ],
                        hoverOffset: 4,
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label;
                                    let value = context.raw;

                                    if (!label)
                                        label = 'Unknown'

                                    let sum = 0;

                                    let dataArr = context.chart.data.datasets[0].data;
                                    
                                    dataArr.map(data => {
                                    	if (typeof data !== 'undefined') {
                                        	sum += Number(data);
                                        }
                                    });
                                    let percentage = (value * 100 / sum).toFixed(2) + '%';
                                    return value + " (" + percentage + ")";
                                }
                            }
                        }
                    }],
                };

                //this.$nextTick(function () {
                    this.toggle_loading_circle(chart_type,false);
                    stats_app.create_donut(chart_type, view_data, bgd_color, text_color);
                //});
            },
            create_cookie_timestamp(){
                var date = new Date(new Date(Date.now()));
                date = this.$parent.format_date(date,this.$parent.datetime_format,true);
                return date;
            },
            // function to fetch data for charts and save cache to cookies
            async call_stats_data(chart_type){
               
                if (chart_type == 'overall_pie') {
                    var url = base_url3, queries = 0;
                    url += (queries === 0) ? '?' : '&';
                    
                    for (const element of ['sent','deferred','reject','bounced','unknown','multiple']) {
                      url_upd = url+`statuses=`+element;
                      response = await this.fetch_stats_data(url_upd,chart_type,element);
                    }
                    
                    // store to cookie with expiration after hour
                    if (response == 0) {
                        return 0;
                    } else {
                        if (!(((this.array_overall['sent'] == null) && (this.array_overall['deferred'] == null) && (this.array_overall['reject'] == null) && (this.array_overall['bounced'] == null) && (this.array_overall['unknown'] == null) && (this.array_overall['multiple'] == null)))) {
                            document.cookie = chart_type+"="+JSON.stringify(this.array_overall)+"; max-age=3600"
                            
                            document.cookie = chart_type+"_created="+this.create_cookie_timestamp()+"; max-age=3600"
                            return 1;
                        } else {
                            return this.array_overall
                        }
                    }


                } else if (chart_type == 'filtered_pie') {
                    var url = base_url, queries = 0;
                    url += '?';
                    var element_status = '';

                    // add filter equal flag
                    if (this.$parent.search.length > 0) {
                        url += `equal=${this.$parent.isEqual}&`;
                        queries += 1;
                    }

                    for (var f in this.$parent.email_filter) {
                        if (f != 'status.code') {
                            url += `${f}=${this.$parent.email_filter[f]}&`;
                            queries += 1;
                            
                        } else {
                            element_status = this.$parent.email_filter[f];
                        }
                    }
                    url += (queries === 0) ? '&' : '';

                    if (element_status != '') {
                        url_upd = url+`status.code=`+element_status;
                        url_upd += `&page=${this.$parent.page}&limit=${this.$parent.settings.page_limit}`;
                        response = await this.fetch_stats_data(url_upd,chart_type,element_status);
                    } else {
                        // check for statuses in current fetched emails table
                        var statuses = [];
                        for (let i = 0; i < this.$parent.emails.length; i++) {
                             if (statuses.indexOf(this.$parent.emails[i].status.code) === -1) {
                                statuses.push(this.$parent.emails[i].status.code)
                             }
                        }
                        if (statuses.length < 1) {
                            response = 0;
                        } else {
                            for (const element of statuses) {
                            url_upd = url+`status.code=`+element;
                            url_upd += `&page=${this.$parent.page}&limit=${this.$parent.settings.page_limit}`;
                            response = await this.fetch_stats_data(url_upd,chart_type,element);
                            }
                        }
                    }
                    // store to cookie with expiration after hour
                    if (response == 0) {
                        return 0;
                    } else {
                        if (!(((this.array_filtered['sent'] == null) && (this.array_filtered['deferred'] == null) && (this.array_filtered['reject'] == null) && (this.array_filtered['bounced'] == null) && (this.array_filtered['unknown'] == null) && (this.array_filtered['multiple'] == null)))) {
                            document.cookie = chart_type+"="+JSON.stringify(this.array_filtered)+"; max-age=3600"
                            document.cookie = chart_type+"_created="+this.create_cookie_timestamp()+"; max-age=3600"
                            return 1;
                        } else {
                            return this.array_filtered
                        } 
                    }

                } else if (chart_type == 'filtered_top_senders'){
                    var url = base_url3, queries = 0;
                    url += '?top_senders&';

                    // add filter equal flag
                    if (this.$parent.search.length > 0) {
                        url += `equal=${this.$parent.isEqual}&`;
                        queries += 1;
                    }

                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
                    }
                    if (typeof(stats_app.$parent.getCookie(chart_type+"_excluded")) !== 'undefined') {
                        url += `&`+chart_type+`_excluded=`+stats_app.$parent.getCookie(chart_type+"_excluded");
                    }

                    url_upd = url;
                    response = await this.fetch_stats_data(url_upd,chart_type,0);
                    // store to cookie with expiration after hour
                    if (response == 0) {
                        return 0;
                    } else {
                        if (!(this.array_filtered_top_senders.error)) {
                            document.cookie = chart_type+"="+JSON.stringify(this.array_filtered_top_senders)+"; max-age=3600"
                            document.cookie = chart_type+"_created="+this.create_cookie_timestamp()+"; max-age=3600"
                            return 1;
                        } else {
                            return this.array_filtered_top_senders
                        } 
                    }
                } else if (chart_type == 'filtered_top_recipients'){
                    var url = base_url3, queries = 0;
                    url += '?top_recipients&';

                    // add filter equal flag
                    if (this.$parent.search.length > 0) {
                        url += `equal=${this.$parent.isEqual}&`;
                        queries += 1;
                    }
                    
                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
                    }

                    if (typeof(stats_app.$parent.getCookie(chart_type+"_excluded")) !== 'undefined') {
                        url += `&`+chart_type+`_excluded=`+stats_app.$parent.getCookie(chart_type+"_excluded");
                    }
                    url_upd = url;
                    response = await this.fetch_stats_data(url_upd,chart_type,0);
                    // store to cookie with expiration after hour
                    if (response == 0) {
                        return 0;
                    } else {
                        if (!(this.array_filtered_top_recipients.error)) {
                            document.cookie = chart_type+"="+JSON.stringify(this.array_filtered_top_recipients)+"; max-age=3600"
                            document.cookie = chart_type+"_created="+this.create_cookie_timestamp()+"; max-age=3600"
                            return 1;
                        } else {
                            return this.array_filtered_top_recipients;
                        }
                    }
                }

                return 0;
            },
            fetch_stats_data(url,chart_type,element){

                return fetch(url).then(function (response) {
                    return response.clone().json();
                }).then((res) => {
                    if (chart_type == 'overall_pie') {
                        this.array_overall[element] = res[element];
                    }
                    if (chart_type == 'filtered_pie') {
                        this.array_filtered[element] = res['count'];
                    }
                    if (chart_type == 'filtered_top_senders') {
                        this.array_filtered_top_senders = res;
                    }
                    if (chart_type == 'filtered_top_recipients') {
                        this.array_filtered_top_recipients = res;
                    }
                }).catch((res) => {
                    console.error('Error:', res);
                    if ((chart_type == 'overall_pie') || (chart_type == 'filtered_pie')) {
						this.create_donut(chart_type)
					} else {
						this.create_chart(chart_type)
					}
                    return 0;
                });
            },
            force_refresh: function (event) {

                if (event.target) {

                    chart_type = event.target.classList[0];
                    
                     // show rotation animation
                    $('.'+chart_type).addClass('rotate');
                    setTimeout(() =>  $('.'+chart_type).removeClass('rotate'), 1000);

                } else {
                    chart_type = event
                }
                this.$parent.clear_cookies(chart_type);
                this.$parent.clear_cookies(chart_type+"_created");
                // stop_draws causes errors when cookies removed and chart must be refreshed
                //this.stop_draws(chart_type);
                this.run_draws(chart_type);
            },
            run_draws(chart_type) {
                if ((chart_type == 'overall_pie') || (chart_type == 'filtered_pie')) {
                	// draw donuts
                    this.draw_donut(chart_type, 1);
                }
                if ((chart_type == 'filtered_top_senders') || (chart_type == 'filtered_top_recipients')) {
                    // draw bars
                    this.draw_chart(chart_type, 1);
                }
            },
            toggle_loading_circle(chart_type,operation) {
                if (chart_type == 'overall_pie') {
                    this.loading_overall_pie = operation;
                }
                if (chart_type == 'filtered_pie') {
                    this.loading_filtered_pie = operation;
                }
                if (chart_type == 'filtered_top_senders') {
                    this.loading_filtered_top_senders = operation;
                }
                if (chart_type == 'filtered_top_recipients') {
                    this.loading_filtered_top_recipients = operation;
                }
            },
            stop_draws(chart_type) {
				if (Chart.getChart(chart_type) != undefined) {
				  Chart.getChart(chart_type).destroy();
				}
            },
            add_hidden_indicator(chart_type) {
                if (stats_app.get_excluded(chart_type)) {
                    stats_app['hidden_indicator_'+chart_type] = true;
                } else {
                    stats_app['hidden_indicator_'+chart_type] = false;
                }
            },
            check_filters_changes(chart_type){
                if (this.$parent.filters_changed) {
                    this.$nextTick(function () {
                        if (chart_type != 'overall_pie') {
                            //console.log("Filter values were changed. Clear filtered stats cookies and recache.");
                            this.force_refresh(chart_type);
                        }

                        this.$parent.filters_changed = false;
                    });
                }
            },
            exclude_selected(selected, chart_type) {
                chart = Chart.getChart(chart_type);

                // if unknown replace selected.data with the following
                if (selected.data == stats_app.$parent.localeData.filters.status_filter_unknown) {
                    selected.data = '';
                }

                if (typeof(stats_app.$parent.getCookie(chart_type+"_excluded")) !== 'undefined') {

                    //var cookie = stats_app.$parent.getCookie(chart_type+"_excluded").replace(/["']/g, "");
                    var cookie = JSON.parse(stats_app.$parent.getCookie(chart_type+"_excluded"));
                    //cookie = cookie + "," + JSON.stringify(selected.data).replace(/["']/g, "");
                    cookie.push(selected.data);
                    document.cookie = chart_type+"_excluded="+JSON.stringify(cookie);
                } else {
                    //document.cookie = chart_type+"_excluded="+JSON.stringify(selected.data).replace(/["']/g, "");
                    var cookie = new Array;
                    cookie.push(selected.data);
                    document.cookie = chart_type+"_excluded="+JSON.stringify(cookie);
                }
                this.force_refresh(chart_type);
            },
            get_excluded(chart_type) {
                if (typeof(stats_app.$parent.getCookie(chart_type+"_excluded")) !== 'undefined') {
                    //var cookie = stats_app.$parent.getCookie(chart_type+"_excluded").replace(/["']/g, "");
                    var cookie = JSON.parse(stats_app.$parent.getCookie(chart_type+"_excluded"));
                    //console.log(cookie)
                    //var excluded = cookie.split(',');
                    //var excluded = cookie
                    //console.log(excluded);
                    return cookie;
                }
            },
            remove_from_excluded(element,chart_type) {
                var arr = this.get_excluded(chart_type);

                var filteredArray = arr.filter(function(e) { return e !== element });

                if ((filteredArray.length < 1) || (typeof (filteredArray) == 'undefined')) {
                    this.remove_all_excluded(chart_type);
                } else {
                    document.cookie = chart_type+"_excluded="+JSON.stringify(filteredArray);
                }
                // check saved excludes
                this.force_refresh(chart_type);
            },
            remove_all_excluded(chart_type) {
                this.$parent.clear_cookies(chart_type+"_excluded");
                this.force_refresh(chart_type);
            }
        },
        mounted() {
            // add housekeeping days to overall stats title
            if (housekeeping_days > 0) {
                $('#overall_pie_title span').text($('#overall_pie_title span').text()+" "+this.$parent.localeData.overall_pie_ally+" "+housekeeping_days+" "+this.$parent.localeData.overall_pie_end)
            }
            
            // save stats_app for further usage
            stats_app = this;
            // set stats hidden by default if not saved
            if (localStorage.getItem("hidden_stats") === null) {
                $('#charts-wrapper').hide();
                this.$parent.hidden_stats = true;
                this.stop_draws('overall_pie');
                this.stop_draws('filtered_pie');
                this.stop_draws('filtered_top_senders');
                this.stop_draws('filtered_top_recipients');
            }

            //if ((localStorage.getItem("hidden_stats") === null) || (localStorage.getItem("hidden_stats") === 'false'))  {
            if (localStorage.getItem("hidden_stats") === 'false')  {
                $('#charts-wrapper').show();
                this.$parent.hidden_stats = false;
                this.run_draws('overall_pie');
                this.run_draws('filtered_pie');
                this.run_draws('filtered_top_senders');
                this.run_draws('filtered_top_recipients');
            } else {
                $('#charts-wrapper').hide();
                this.$parent.hidden_stats = true;
                this.stop_draws('overall_pie');
                this.stop_draws('filtered_pie');
                this.stop_draws('filtered_top_senders');
                this.stop_draws('filtered_top_recipients');
            }
        }
    });
