    app.component('stats', {
        template: `
        <div id="charts-wrapper" class="ui segment stackable two column grid">
            <div class="three wide column">
                <h3><i class="calendar outline icon"></i><i class="chart pie icon"></i><span v-if="$parent.localeData.overall_pie" v-html="$parent.localeData.overall_pie"></span><span v-else v-html="$parent.fallbackLocaleData.overall_pie"></span><i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="overall_pie stats_refresh sync icon"></i></h3>
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
                <h3><i class="chart bar icon"></i><span v-if="$parent.localeData.filtered_top_senders" v-html="$parent.localeData.filtered_top_senders"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_top_senders"></span><i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="filtered_top_senders stats_refresh sync icon"></i></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_senders" id="filtered_top_senders"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
                <h3><i class="chart bar outline icon"></i><span v-if="$parent.localeData.filtered_top_recipients" v-html="$parent.localeData.filtered_top_recipients"></span><span v-else v-html="$parent.fallbackLocaleData.filtered_top_recipients"></span><i :title="$parent.localeData.force_refresh_stats" @click="force_refresh" class="filtered_top_recipients stats_refresh sync icon"></i></h3>
                <div class="ui form">
                    <canvas v-if="!loading_filtered_top_recipients" id="filtered_top_recipients"></canvas>
                    <div v-else class="ui active huge indeterminate text loader">
                        <span v-if="$parent.localeData.loading" v-html="$parent.localeData.loading"></span>
                        <span v-else v-html="$parent.fallbackLocaleData.loading"></span>
                    </div>
                </div>
            </div>

        </div>`,
        data() {
            return {
                array_overall: {},
                array_filtered: {},
                array_filtered_top_senders: [],
                array_filtered_top_recipients: {},
                loading_overall_pie: false,
                loading_filtered_pie: false,
                loading_filtered_top_senders: false,
                loading_filtered_top_recipients: false,
                loading_filtered_throughoutput: false,
                noData_plugin: {
                  id: 'noData',
                  afterDraw(chart, args, options) {
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
                        // add watermarked current timestamp
                        if (chart.config._config.type == 'doughnut') {
                            fontSize = (chart.height / 400).toFixed(2);
                            ch_height = chart.height/1.3
                            ch_width = chart.width / 2
                            ctx.textAlign = 'center';
                        } else {
                            fontSize = (chart.height / 200).toFixed(2);
                            ch_height = chart.height / 2
                            ch_width = chart.width / 1.5
                            ctx.textAlign = 'left';
                        }
                        ctx.globalAlpha = .4;
                        ctx.textBaseline = 'bottom';
                        ctx.font = fontSize + "rem Arial";
                        ctx.fillStyle = text_color;
                        timestamp = stats_app.$parent.format_date(stats_app.$parent.getCookie(chart.canvas.id+"_created"),datetime_format,false);
                        ctx.fillText(stats_app.$parent.localeData.cached + " " + timestamp, ch_width, ch_height);
                        ctx.closePath();
                        ctx.globalAlpha = 1;
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
                if (chart_type == 'overall_pie') {
                    stats_app.loading_overall_pie = false;
                }
                if (chart_type == 'filtered_pie') {
                    stats_app.loading_filtered_pie = false;
                }
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
                                    labels: {
                                        filter: (legendItem, data) => (
                                            data.datasets[0].data[legendItem.index] != 0 && typeof data.datasets[0].data[legendItem.index] !== 'undefined'
                                        ),
                                        color: text_color,
                                        font: {
                                            size: 15
                                        }
                                    }
                                },
                            },
                            responsive: true,
                            maintainAspectRatio: false,
                            onHover: (event, chartElement) => {
                                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'
                            },
                            onClick: (e, element) => {
                              const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, true);
                              if (elements.length) {
                                this.$parent.status_filter = chart.data.labels[elements[0].index]
                              }
                            },
                        }
                    });
                })
            },

            create_chart(chart_type, view_data, bgd_color, text_color) {
                if (chart_type == 'filtered_top_senders') {
                    stats_app.loading_filtered_top_senders = false;
                }
                if (chart_type == 'filtered_top_recipients') {
                    stats_app.loading_filtered_top_recipients = false;
                }
                this.$nextTick(function () {
    				const ctx = document.getElementById(chart_type);
                    this.stop_draws(chart_type);
                    let chart = new Chart(ctx, {
                        type: 'bar',
                        data: view_data,
                        plugins: [stats_app.noData_plugin],
                        options: {
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
                                    fontColor: text_color,
                                    backdropColor: text_color,
                                    color: text_color,
                                    font: {
                                            size: 15
                                        }
                                    }
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
                            responsive: true,
                            maintainAspectRatio: false,
                            onHover: (event, chartElement) => {
                                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default'
                            },
                            onClick: (e, element) => {
                              const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: true }, true);
                              //console.log(chart.data.labels[elements[0].index])
                              //return 0;
                              if (elements.length) {
                                if (chart.ctx.canvas.id == "filtered_top_senders") {
                                    if (chart.data.labels[elements[0].index] != "unknown") {
                                        this.$parent.search_by = 'mail_from';
                                        this.$parent.search = chart.data.labels[elements[0].index]
                                    }
                                    // debounce if no text validation errors
                                    stats_app.$nextTick(function () {
                                        stats_app.$parent.check_button();
                                    })
                                }
                                if (chart.ctx.canvas.id == "filtered_top_recipients") {
                                    if (chart.data.labels[elements[0].index] != "unknown") {
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
                //if (mode == 1) {
                    // check cache in cookie with expiration
                    if ((this.$parent.getCookie(chart_type)) && (this.$parent.getCookie(chart_type) !== '{}')) {

                        if (chart_type == 'filtered_top_senders') {
                            this.loading_filtered_top_senders = true;
                            // get cached data from cookie
                            data = JSON.parse(this.$parent.getCookie(chart_type));
                            this.loading_filtered_top_senders = false;
                        }
                        if (chart_type == 'filtered_top_recipients') {
                            // get cached data from cookie
                            this.loading_filtered_top_recipients = true;
                            data = JSON.parse(this.$parent.getCookie(chart_type));
                            this.loading_filtered_top_recipients = false;
                        }
                        this.check_filters_changes();
                    } else {
                        try {
                            if (chart_type == 'filtered_top_senders') {
                                this.loading_filtered_top_senders = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_chart(chart_type,0);
                                    return 0;
                                } else {
                                    this.loading_filtered_top_senders = false;
                                    data = 'error'
                                    //return 0;
                                }
                            }
                            if (chart_type == 'filtered_top_recipients') {
                                this.loading_filtered_top_recipients = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    this.draw_chart(chart_type,0);
                                    return 0;
                                } else {
                                    this.loading_filtered_top_recipients = false;
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
                stats_app = this

                if (chart_type == 'filtered_top_senders') {
                    this.loading_filtered_top_senders = false;
                    if (data !== 'error') {
                        data.forEach((item, index) => {
                              dataset.push(item['count'])
                              if ((item['mail_from'] !== '')&&(item['mail_from'] !== '<>')) {
                                labels.push(item['mail_from'])
                              } else {
                                labels.push('unknown')
                              }
                        })
                    } else {
                        if (!(this.array_filtered_top_senders.error)) {
    	                    this.array_filtered_top_senders.forEach((item, index) => {
    	                      dataset.push(item['count'])
    	                      if ((item['mail_from'] !== '')&&(item['mail_from'] !== '<>')) {
                                labels.push(item['mail_from'])
                              } else {
                                labels.push('unknown')
                              }
    	                    })
    	                }
                    }
                }

                if (chart_type == 'filtered_top_recipients') {
                    this.loading_filtered_top_recipients = false;
                    if (data !== 'error') {
                        data.forEach((item, index) => {
                              dataset.push(item['count'])
                              if (item['mail_to'] !== '') {
                                labels.push(item['mail_to'])
                              } else {
                                labels.push('unknown')
                              }
                        })
                    } else {
                        if (!(this.array_filtered_top_recipients.error)) {
    	                    this.array_filtered_top_recipients.forEach((item, index) => {
    	                      dataset.push(item['count'])
    	                      if (item['mail_to'] !== '') {
                                labels.push(item['mail_to'])
                              } else {
                                labels.push('unknown')
                              }
    	                    })
    	                }
                    }
                }
                // 
                var view_data = {
                  labels: labels,
                  datasets: [{
                    indexAxis: 'y',
                    data: dataset,
                    fill: false,
                    backgroundColor: stats_app.poolColors(dataset.length),
                    borderColor: 'rgba(128, 128, 128, 0.3)',
                    borderWidth: 1
                  }]
                };

                //this.$nextTick(function () {
                    stats_app.create_chart(chart_type, view_data, bgd_color, text_color)
                //});
            },
            async draw_donut(chart_type,mode) {
                //if (mode == 1) {
                    // check cache in cookie with expiration
                    if ((this.$parent.getCookie(chart_type))/* && (this.$parent.getCookie(chart_type) !== '{}'*/) {

                        if (chart_type == 'overall_pie') {
                            this.loading_overall_pie = true;
                            // get cached data from cookie
                            data = JSON.parse(this.$parent.getCookie(chart_type));
                            this.loading_overall_pie = false;
                        }
                        if (chart_type == 'filtered_pie') {
                            // get cached data from cookie
                            this.loading_filtered_pie = true;
                            data = JSON.parse(this.$parent.getCookie(chart_type));
                            this.loading_filtered_pie = false;
                        }

                        this.check_filters_changes();

                    } else {
                        try {
                            if (chart_type == 'overall_pie') {
                                this.loading_overall_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    //data = this.array_overall
                                    this.draw_donut(chart_type,1);
                                    //return 0;
                                } else {
                                    this.loading_overall_pie = false;
                                    data = "error"
                                    //return 0;
                                }
                            }
                            if (chart_type == 'filtered_pie') {
                                this.loading_filtered_pie = true;
                                let result = await this.call_stats_data(chart_type);
                                if (result == 1) {
                                    //data = this.array_filtered
                                    this.draw_donut(chart_type,0);
                                    //return 0;
                                } else {
                                    this.loading_filtered_pie = false;
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

                stats_app = this
                if (data !== 'error') {
                    var dataset = [data['sent'], data['deferred'], data['reject'], data['bounced'], data['unknown'], data['multiple']]
                } else {
                    var dataset = '';
                }
                

                var view_data = {
                    labels: ['sent', 'deferred', 'reject', 'bounced', 'unknown', 'multiple'],
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
                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
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
                    for (var f in this.$parent.email_filter) {
                        url += `${f}=${this.$parent.email_filter[f]}&`;
                        queries += 1;
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
                chart_type = event.target.classList[0];
                // show rotation animation
                $('.'+chart_type).addClass('rotate');
                setTimeout(() =>  $('.'+chart_type).removeClass('rotate'), 1000);
                
                this.$parent.clear_cookies(chart_type);
                this.$parent.clear_cookies(chart_type+"_created");
                this.stop_draws(chart_type);
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
            stop_draws(chart_type) {
				if (Chart.getChart(chart_type) != undefined) {
				  Chart.getChart(chart_type).destroy();
				}

            },
            check_filters_changes(){
                if ((!('filters' in window.localStorage)) ||(window.localStorage['filters'] === 'false')) {
                    //console.log("Don't cache stats!")
                    if (this.$parent.filters_changed) {
                        this.$parent.clear_cookies('filtered_pie');
                        this.$parent.clear_cookies('filtered_pie_created');
                        this.$parent.clear_cookies('filtered_top_senders');
                        this.$parent.clear_cookies('filtered_top_senders_created');
                        this.$parent.clear_cookies('filtered_top_recipients');
                        this.$parent.clear_cookies('filtered_top_recipients_created');
                    }
                    return 0;
                } else {
                    if (this.$parent.filters_changed) {
                        //console.log("Filter values were changed. Clear filtered stats cookies and recache.")
                        this.$parent.clear_cookies('filtered_pie');
                        this.$parent.clear_cookies('filtered_pie_created');
                        this.$parent.clear_cookies('filtered_top_senders');
                        this.$parent.clear_cookies('filtered_top_senders_created');
                        this.$parent.clear_cookies('filtered_top_recipients');
                        this.$parent.clear_cookies('filtered_top_recipients_created');
                        return 1;
                    } else {
                        //console.log("Caching stats!")
                        return 0;
                    }
                }
            }

        },
        mounted() {

            if ((localStorage.getItem("hidden_stats") === null) || (localStorage.getItem("hidden_stats") === 'false'))  {
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
