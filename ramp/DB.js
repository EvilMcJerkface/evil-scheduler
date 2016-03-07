module.exports = DB;

function DB() {
    var id_gen = 0;
    this.values = [];
    this.index = {};
    this.committed = {};
    this.proposers = [];
    this.broadcasts = [];
    this.broadcast_ballot_number = function(n) {
        this.broadcasts.push({id:id_gen++, n:n});
    };
    this.apply_ballot_number = function(id) {
        var nova = [];
        this.broadcasts.forEach(function(req) {
            if (req.id == id) {
                this.proposers.forEach(function(proposer) {
                    proposer.n = Math.max(proposer.n, req.n);
                });
            } else {
                nova.push(req);
            }
        }.bind(this));
        this.broadcasts = nova;
    };
    this.gc = function() {
        var next = [];
        this.values.forEach(function(value) {
            if (value.txid == this.committed[value.key.lender][value.key.debtor].txid) {
                next.push(value);
            }
        }.bind(this));
        this.values = next;
    };
    this.prepare = function(shard, values) {
        console.log(shard);
        console.log(values);
        for (var i=0;i<values.length;i++) {
            var value = clone(values[i]);
            if (!this.index.hasOwnProperty(shard)) {
                this.index[shard] = {};
            }
            if (!this.index[shard].hasOwnProperty(value.key.debtor)) {
                this.index[shard][value.key.debtor] = {};
            }
            this.index[shard][value.key.debtor]["" + value.txid] = value;
            this.values.push(value);
        }
    };
    this.commit = function(shard, txids) {
        if (!this.committed.hasOwnProperty(shard)) {
            this.committed[shard] = {};
        }

        var txid_index = {};
        txids.forEach(function(txid){
            txid_index[txid]=true;
        });

        this.values.forEach(function(value) {
            if (value.key.lender==shard && txid_index[value.txid]) {
                if (!this.committed[shard].hasOwnProperty(value.key.debtor)) {
                    this.committed[shard][value.key.debtor] = { 
                        txid: value.txid, confirmed: false
                    };
                }
                if (this.committed[shard][value.key.debtor].txid < value.txid) {
                    this.committed[shard][value.key.debtor].txid = value.txid;
                    this.committed[shard][value.key.debtor].confirmed = false;
                }
            }
        }.bind(this));
    };
    this.confirm = function(shard, txids) {
        var txid_index = {};
        txids.forEach(function(txid){
            txid_index[txid]=true;
        });

        this.values.forEach(function(value) {
            if (value.key.lender==shard && txid_index[value.txid]) {
                if (this.committed[shard][value.key.debtor].txid == value.txid) {
                    this.committed[shard][value.key.debtor].confirmed = true;
                }
            }
        }.bind(this));
    };
    this.get = function(shard, values) {
        var result = [];

        values.forEach(function(value) {
            var txid = value.txid;
            if (txid==null) {
                txid = this.committed[shard][value.key.debtor].txid;
            }

            var obj = clone(this.index[shard][value.key.debtor]["" + txid]);
            if (this.committed.hasOwnProperty(shard) && 
                this.committed[shard].hasOwnProperty(value.key.debtor) &&
                this.committed[shard][value.key.debtor].txid == txid
            ) {
                obj.confirmed = this.committed[shard][value.key.debtor].confirmed;
            }
            result.push(obj);
        }.bind(this));

        return result;
    };
    this.get_debts = function(person) {
        var result = [];
        for (var key in this.committed[person]) {
            if (!this.committed[person].hasOwnProperty(key)) {
                continue;
            }
            var txid = this.committed[person][key].txid;
            result.push(clone(this.index[person][key][txid]));
        }
        return result;
    };
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }