module.exports = {
    __storage: {},
    __txid: 0,
    get: function(key) {
        if (!this.__storage.hasOwnProperty(key)) {
            throw "WTF?!";
        }
        return deep_copy(this.__storage[key]);
    },
    put: function(key, object) {
        object = deep_copy(object);
        this.__storage[key] = object;
    },
    put_cas: function(key, object, cas) {
        object = deep_copy(object);
        var obj = this.get(key);
        for (var prop in cas) {
            if (cas.hasOwnProperty(prop)) {
                if (obj[prop]!=cas[prop]) {
                    return false;
                }
            }
        }
        this.__storage[key] = object;
        return true;
    },
    put_if: function(key, object, test) {
        object = deep_copy(object);
        var obj = this.get(key);
        if (!test(obj)) {
            return false;
        }
        this.__storage[key] = object;
        return true;
    },
    new_tx: function() {
        var tx_id = "tx:" + (this.__txid++);
        var tx = {ver: 0, status: "pending"};
        this.put(tx_id, tx);
        tx.id = tx_id;
        return tx;
    }
};

function deep_copy(object) {
    return JSON.parse(JSON.stringify(object));
}