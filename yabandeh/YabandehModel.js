module.exports = YabandehModel;

var dsl = require("../stepbystep/dsl");

var Statement = dsl.Statement;
var Abort = dsl.Abort;
var Seq = dsl.Seq;
var Cond = dsl.Cond;
var Fun = dsl.Fun;
var Call = dsl.Call;
var Return = dsl.Return;

var model = require("../stepbystep/model");
var AppModel = model.AppModel;
var ThreadModel = model.ThreadModel;

var db = require("./DB");

db.put("a", {ver: 0, value: "\"a\"", future: null, tx_link: null});
db.put("b", {ver: 0, value: "\"b\"", future: null, tx_link: null});
db.put("c", {ver: 0, value: "\"c\"", future: null, tx_link: null});

function equal(x,y) {
    return sub(x,y) && sub(y,x);
    function sub(x,y) {
        for (var prop in x) {
            if (x.hasOwnProperty(prop)) {
                if (x[prop]!=y[prop]) {
                    return false;
                }
            }
        }
        return true;
    }
}

var __clean_read = Fun("clean_read(key)", Seq([
    Statement("var obj = db.get(key);", function(ctx) { ctx.obj = db.get(ctx.key); }),
    Cond("obj.tx_link != null", function(ctx) { return ctx.obj.tx_link != null; }, Seq([
        Statement("var status = null;",            function(ctx) { ctx.status = null; }),
        Statement("var tx = db.get(obj.tx_link);", function(ctx) { ctx.tx = db.get(ctx.obj.tx_link); }),
        
        Cond("tx.status==\"pending\"", function(ctx) { return ctx.tx.status=="pending"; }, Seq([
            Statement("var aborted = {status: \"aborted\", ver: tx.ver+1};", 
                      function(ctx) { ctx.aborted = {status: "aborted", ver: ctx.tx.ver + 1}; }),
            Cond("db.put_cas(obj.tx_link, aborted, {ver: tx.ver}",
                 function(ctx) { return db.put_cas(ctx.obj.tx_link, ctx.aborted, {ver: ctx.tx.ver}); }, Seq([
                Statement("status = \"aborted\";", 
                          function(ctx) { ctx.status = "aborted"; })
            ]), Seq([
                Statement("status = db.get(obj.tx_link).status;", 
                          function(ctx) { ctx.status = db.get(ctx.obj.tx_link).status; })
            ]))
        ]), Seq([
            Statement("status = tx.status;", function(ctx) { ctx.status = ctx.tx.status; })
        ])),

        Cond("status == \"aborted\"", function(ctx) { return ctx.status == "aborted"; }, Seq([
            Statement("obj.future = null;", function(ctx) { ctx.obj.future = null; }),
            Statement("obj.tx_link = null;", function(ctx) { ctx.obj.tx_link = null; }),
            Return("return obj;", function(ctx) { return ctx.obj; })
        ])),

        Cond("status == \"committed\"", function(ctx) { return ctx.status == "committed"; }, Seq([
            Statement("var clean = {\n    value: obj.future,\n    ver: obj.ver + 1,\n    tx_link: null\n};", 
                      function(ctx) { ctx.clean = {value: ctx.obj.future, ver: ctx.obj.ver + 1, tx_link: null}; }),
            Statement("var cond = function(x) {\n    return equal(x, clean) || x.ver==obj.ver;\n};", 
                      function(ctx) { ctx.cond = function(x) { return equal(x, ctx.clean) || x.ver==ctx.obj.ver; }; }),
            Cond("db.put_if(key, clean, cond)", function(ctx) { return db.put_if(ctx.key, ctx.clean, ctx.cond); }, Seq([
                Return("return clean;", function(ctx) { return ctx.clean; })
            ]))
        ])),

        Abort("throw \"exit\";")
    ])),
    Return("return obj;", function(ctx) { return ctx.obj; })
]));

var __update = Fun("update(tx_key, key, obj, value)", Seq([
    Statement("var updated = {\n" +
              "    value: obj.value,\n" +
              "    future: value,\n" +
              "    ver: obj.ver+1,\n" +
              "    tx_link: tx_key\n" +
              "};", function(ctx) {
        ctx.updated = {
            value: ctx.obj.value,
            future: ctx.value,
            ver: ctx.obj.ver + 1,
            tx_link: ctx.tx_key
        };
    }),
    Cond("db.put_cas(\n" +
         "    key,\n" +
         "    updated,\n" +
         "    {ver: obj.ver}\n" +
         ")", function(ctx) { return db.put_cas(ctx.key, ctx.updated, {ver: ctx.obj.ver}); }, Seq([
        Return("return updated;", function(ctx) { return ctx.updated; })
    ])),
    Abort("throw \"exit\";")
]));

var __commit = Fun("commit(tx_key, tx)", Seq([
    Statement("var committed = {\n" +
              "    status: \"committed\",\n" +
              "    ver: tx.ver+1\n" +
              "};", function(ctx){
        ctx.committed = { status: "committed", ver: ctx.tx.ver+1 };
    }),
    Cond("!db.put_cas(\n" +
         "    tx_key,\n" +
         "    committed,\n" +
         "    {ver: tx.ver}\n" +
         ")", function(ctx) { return !db.put_cas(ctx.tx_key, ctx.committed, {ver: ctx.tx.ver}); }, Seq([
        Abort("throw \"exit\";")
    ]))
]));

var __clean = Fun("clean(key, obj)", Seq([
    Statement("var tidy = {\n" + 
              "    value: obj.future,\n" + 
              "    ver: obj.ver+1,\n" + 
              "    future: null,\n" +
              "    tx_link: null,\n" + 
              "};", function(ctx) {
        ctx.tidy = {value: ctx.obj.future, ver: ctx.obj.ver + 1, future: null, tx_link: null};
    }),
    Statement("db.put_cas(key, tidy, {ver: obj.ver});", function(ctx) {
        db.put_cas(ctx.key, ctx.tidy, {ver: ctx.obj.ver});
    })
]));



function get_swap_tx(tx, var1, var2) {
    return Seq([
        Statement("var " + tx + " = db.new_tx();", function(ctx) { 
            ctx[tx] = db.new_tx(); 
        }),
        Call(
            "var " + var1 + " = clean_read(\"" + var1 + "\");",
            function(ctx) { return { key: var1 }; },
            __clean_read,
            function(ctx, ret) { 
                ctx[var1] = ret;
            }
        ),
        Call(
            "var " + var2 + " = clean_read(\"" + var2 + "\");",
            function(ctx) { return { key: var2 }; },
            __clean_read,
            function(ctx, ret) { 
                ctx[var2] = ret; 
            }
        ),
        Call(
            var1 + " = update(" + tx + ".id, \"" + var1 + "\", " + var1 + ", " + var2 + ".value);",
            function(ctx) { 
                return { tx_key: ctx[tx].id, key: var1, obj: ctx[var1], value: ctx[var2].value }; 
            },
            __update,
            function(ctx, ret) { ctx[var1] = ret; }
        ),
        Call(
            var2 + " = update(" + tx + ".id, \"" + var2 + "\", " + var2 + ", " + var1 + ".value);",
            function(ctx) { return { tx_key: ctx[tx].id, key: var2, obj: ctx[var2], value: ctx[var1].value }; },
            __update,
            function(ctx, ret) { ctx[var2] = ret; }
        ),
        Call(
            "commit(" + tx + ".id, " + tx + ");",
            function(ctx) { return { tx_key: ctx[tx].id, tx: ctx[tx] }; },
            __commit,
            function(ctx, ret) { }
        ),
        Call(
            "clean(\"" + var1 + "\", " + var1 + ");",
            function(ctx) { return { key: var1, obj: ctx[var1] }; },
            __clean,
            function(ctx, ret) { }
        ),
        Call(
            "clean(\"" + var2 + "\", " + var2 + ");",
            function(ctx) { return { key: var2, obj: ctx[var2] }; },
            __clean,
            function(ctx, ret) { }
        )
    ]);
}

__tx1 = get_swap_tx("tx1", "a", "b");
__tx2 = get_swap_tx("tx2", "b", "c");
    

function YabandehModel() {
    var app_model = AppModel();
    app_model.clean_read = __clean_read;
    app_model.update = __update;
    app_model.commit = __commit;
    app_model.clean = __clean;
    app_model.tx1 = ThreadModel(__tx1, app_model, "0");
    app_model.tx2 = ThreadModel(__tx2, app_model, "1");
    app_model.db = db;
    return app_model;
}