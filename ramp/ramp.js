function Key(shard, key) {
    this.shard = shard;
    this.key = key;
}

/// server-side

function prepare(db, values) {
    db.batch_insert(
        "INSERT INTO MultiVersion(key, txid, value, md)
         VALUES(:key,:txid,:value,:md)",
        values
    );
}

function commit(db, txid) {
    var keys = db.select(
        "SELECT key FROM MultiVersion WHERE txid=?", txid
    );
    keys.each(function(key) {
        db.update(
            "UPDATE Committed SET txid = ? 
             WHERE txid < ? AND key = ?",
            txid, key.key
        );
    });
}

function get_any(db, key, txid) {
    return db.select(
        "SELECT m.key, m.ts, m.value, m.md
         FROM MultiVersion m, Committed c
         WHERE m.key=c.key AND
               m.txid=c.txid AND
               m.key=?", key
    )[0];
}

function get_txid(db, key, txid) {
    return db.select(
        "SELECT key, ts, value, md
         FROM MultiVersion
         WHERE key=? AND txid=?", key, txid
    )[0];
}

/// agent

var dbs = ...;

function put_all(changes) {
    var txid = get_txid();
    var md = changes.keys();
    var per_shard = dict(function() { return []; })
    changes.each(function(key, value) {
        per_shard.get(key.shard).push({
            key: key.key, txid: txid, 
            value: value, md.exclude(key)
        });
    });
    per_shard.each(function(shard, changes) {
        prepare(dbs[shard], changes);
    });
    per_shard.each(function(shard, changes) {
        commit(dbs[shard], txid);
    });
}

function get_all(query) {
    var ret = dict();
    query.each(function(shard, keys){
        get_any(dbs[shard],keys).each(function(value){
            ret.put(new Key(shard, value.key), value);
        });
    });
    ////////////
    var last = dict(function(){ return -1; });
    ret.each(function(key, value) {
        value.md.each(function(subling) {
            last.put(subling, Math.max(
                last.get(subling), value.txid
            ));
        });
    });
    query.each(function(key){
        if (last.get(key)>ret.get(key).txid) {
            ret.put(
                key, 
                get_txid(dbs[key.shard],key.key,last.get(key))
            );
        }
    });
    return ret;
}

function get_shard(shard) {
    var deps = dbs[shard].select(
        "SELECT DISTINCT key FROM MultiVersion"
    );
    var per_shard = dict(function() { return []; })
    deps.each(function(dep) {
        per_shard.get(shard).push(dep.key);
        per_shard.get(dep.key).push(shard);
    });
    var result = {};
    get_all(per_shard).each(function(key, value) {
        if (key.shard == shard) {
            result[key.key] = value.value;
        }
    });
    return result;
}