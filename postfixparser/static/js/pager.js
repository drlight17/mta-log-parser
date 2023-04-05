window.addEventListener('load', () => {
    window.Pager = Vue.component('pager', {
        template: `
        <div class="ui buttons">
            <button class="ui labeled icon button navi" :class="{disabled: !has_prev}" @click="$emit('input', 1);">
                <i class="angle double left icon"/><span>First Page</span>
            </button>
            <button class="ui labeled icon button navi" :class="{disabled: !has_prev}" @click="$emit('input', page - 1);">
                <i class="left chevron icon"/><span>Previous Page</span>
            </button>
            <button class="ui button disabled navi">
                <i class="list icon"/><strong><span>Total {{ total_emails }} emails found </span></strong>
            </button>
            <button class="ui button disabled navi">
                <i class="book open icon"/><strong><span>Page {{ page }} of {{ pageCount }}</span></strong>
            </button>
            <button class="ui right labeled icon button navi" :class="{disabled: !has_next}" 
                    @click="$emit('input', page + 1);"><span>Next Page</span><i class="right chevron icon"/>
            </button>
            <button class="ui right labeled icon button navi" :class="{disabled: !has_next}" @click="$emit('input', pageCount);">
                <span>Last Page</span><i class="angle double right icon"/>
            </button>
        </div>`,

        props: {
            value: {
                default: 1,
                type: Number
            },
            pageCount: {
                default: 1,
                type: Number
            },
            emailsCount: {
                default: 0,
                type: Number
            }
        },
        computed: {
            page() {
                return this.value
            },
            has_next() {
                return this.page < this.pageCount;
            },
            has_prev() {
                return this.page > 1;
            },
            total_emails() {
                return this.emailsCount
            },
        }
    });
});

