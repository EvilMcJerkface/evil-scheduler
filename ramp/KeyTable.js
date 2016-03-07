module.exports = KeyTable;

function KeyTable(bydefault) {
    this.store = [];
    this.put = function(key, value) {
        for (var i=0;i<this.store.length;i++) {
            if (this.store[i].has(key)) {
                this.store[i].value = value;
                return;
            }
        }
        this.store.push(item(key, value));
    };
    this.get = function(key) {
        for (var i=0;i<this.store.length;i++) {
            if (this.store[i].has(key)) {
                return this.store[i].value;
            }
        }
        var obj = item(key, bydefault());
        this.store.push(obj);
        return obj.value;
    };
    this.values = function() {
        var result = [];
        for (var i=0;i<this.store.length;i++) {
            result.push(this.store[i].value);
        }
        return result;
    };
    this.forEach = function(iter) {
        for (var i=0;i<this.store.length;i++) {
            iter(this.store[i].key, this.store[i].value);
        }
    };
    this.as_obj = function() {
        var obj = {};
        for (var i=0;i<this.store.length;i++) {
            var key = this.store[i].key.lender + "/" + this.store[i].key.debtor;
            obj[key] = this.store[i].value;
        }
        return obj;
    };
    function item(key, value) {
        return {
            has: function(x) {
                return x.lender == key.lender && x.debtor == key.debtor;
            },
            key: key,
            value: value
        };
    }
}