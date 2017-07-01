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

var hl2 = require("../stepbystep/monokai");

var db = require("./DB");

db.put("a", {ver: 0, value: "\"a\"", future: null, tx_link: null});
db.put("b", {ver: 0, value: "\"b\"", future: null, tx_link: null});
db.put("c", {ver: 0, value: "\"c\"", future: null, tx_link: null});

var __clean_read = Fun(hl2("function clean_read(key) {"), Seq([
    Statement(hl2("var obj = db.get(key);"), function(ctx) { ctx.obj = db.get(ctx.key); }),
    Cond("obj.tx_link != null", function(ctx) { return ctx.obj.tx_link != null; }, Seq([
        Statement(hl2("var status = null;"),            function(ctx) { ctx.status = null; }),
        Statement(hl2("var tx = db.get(obj.tx_link);"), function(ctx) { ctx.tx = db.get(ctx.obj.tx_link); }),
        
        Cond("tx.status==\"pending\"", function(ctx) { return ctx.tx.status=="pending"; }, Seq([
            Statement(hl2("var aborted = {status: \"aborted\", ver: tx.ver+1};"), 
                      function(ctx) { ctx.aborted = {status: "aborted", ver: ctx.tx.ver + 1}; }),
            Cond("db.put_cas(obj.tx_link, aborted, {ver: tx.ver}",
                 function(ctx) { return db.put_cas(ctx.obj.tx_link, ctx.aborted, {ver: ctx.tx.ver}); }, Seq([
                Statement("status = \"aborted\";", 
                          function(ctx) { ctx.status = "aborted"; })
            ]), Seq([
                Statement(hl2("status = db.get(obj.tx_link).status;"), 
                          function(ctx) { ctx.status = db.get(ctx.obj.tx_link).status; })
            ]))
        ]), Seq([
            Statement(hl2("status = tx.status;"), function(ctx) { ctx.status = ctx.tx.status; })
        ])),

        Cond("status == \"aborted\"", function(ctx) { return ctx.status == "aborted"; }, Seq([
            Statement(hl2("obj.future = null;"), function(ctx) { ctx.obj.future = null; }),
            Statement(hl2("obj.tx_link = null;"), function(ctx) { ctx.obj.tx_link = null; }),
            Return(hl2("return obj;"), function(ctx) { return ctx.obj; })
        ])),

        Cond("status == \"committed\"", function(ctx) { return ctx.status == "committed"; }, Seq([
            Statement(hl2("var clean = {\n  value: obj.future,\n  ver: obj.ver + 1,\n  tx_link: null\n};"), 
                      function(ctx) { ctx.clean = {value: ctx.obj.future, ver: ctx.obj.ver + 1, tx_link: null}; }),
            Statement(hl2("var cond = function(x) {\n  return (x.ver==obj.ver+1) || (x.ver==obj.ver);\n};"), 
                      function(ctx) { ctx.cond = function(x) { return (x.ver==ctx.obj.ver+1) || (x.ver==ctx.obj.ver); }; }),
            Cond("db.put_if(key, clean, cond)", function(ctx) { return db.put_if(ctx.key, ctx.clean, ctx.cond); }, Seq([
                Return(hl2("return clean;"), function(ctx) { return ctx.clean; })
            ]))
        ])),

        Abort(hl2("throw \"exit\";"))
    ])),
    Return(hl2("return obj;"), function(ctx) { return ctx.obj; })
]), "}");

var __update = Fun(hl2("function update(tx_key, key, obj, value) {"), Seq([
    Statement(hl2("var updated = {\n" +
              "  value: obj.value,\n" +
              "  future: value,\n" +
              "  ver: obj.ver+1,\n" +
              "  tx_link: tx_key\n" +
              "};"), function(ctx) {
        ctx.updated = {
            value: ctx.obj.value,
            future: ctx.value,
            ver: ctx.obj.ver + 1,
            tx_link: ctx.tx_key
        };
    }),
    Cond("db.put_cas(\n" +
         "  key,\n" +
         "  updated,\n" +
         "  {ver: obj.ver}\n" +
         ")", function(ctx) { return db.put_cas(ctx.key, ctx.updated, {ver: ctx.obj.ver}); }, Seq([
        Return(hl2("return updated;"), function(ctx) { return ctx.updated; })
    ])),
    Abort(hl2("throw \"exit\";"))
]), "}");

var __commit = Fun(hl2("function commit(tx_key, tx) {"), Seq([
    Statement(hl2("var committed = {\n" +
              "  status: \"committed\",\n" +
              "  ver: tx.ver+1\n" +
              "};"), function(ctx){
        ctx.committed = { status: "committed", ver: ctx.tx.ver+1 };
    }),
    Cond("!db.put_cas(\n" +
         "  tx_key,\n" +
         "  committed,\n" +
         "  {ver: tx.ver}\n" +
         ")", function(ctx) { return !db.put_cas(ctx.tx_key, ctx.committed, {ver: ctx.tx.ver}); }, Seq([
        Abort(hl2("throw \"exit\";"))
    ]))
]), "}");

var __clean = Fun(hl2("function clean(key, obj) {"), Seq([
    Statement(hl2("var tidy = {\n" + 
              "  value: obj.future,\n" + 
              "  ver: obj.ver+1,\n" + 
              "  future: null,\n" +
              "  tx_link: null,\n" + 
              "};"), function(ctx) {
        ctx.tidy = {value: ctx.obj.future, ver: ctx.obj.ver + 1, future: null, tx_link: null};
    }),
    Statement(hl2("db.put_cas(key, tidy, {ver: obj.ver});"), function(ctx) {
        db.put_cas(ctx.key, ctx.tidy, {ver: ctx.obj.ver});
    })
]), "}");



function get_swap_tx(tx, var1, var2) {
    return Seq([
        Statement(hl2("var " + tx + " = db.new_tx();"), function(ctx) { 
            ctx[tx] = db.new_tx(); 
        }),
        Call(
            hl2("var " + var1 + " = clean_read(\"" + var1 + "\");"),
            function(ctx) { return { key: var1 }; },
            __clean_read,
            function(ctx, ret) { 
                ctx[var1] = ret;
            }
        ),
        Call(
            hl2("var " + var2 + " = clean_read(\"" + var2 + "\");"),
            function(ctx) { return { key: var2 }; },
            __clean_read,
            function(ctx, ret) { 
                ctx[var2] = ret; 
            }
        ),
        Call(
            hl2(var1 + " = update(" + tx + ".id, \"" + var1 + "\", " + var1 + ", " + var2 + ".value);"),
            function(ctx) { 
                return { tx_key: ctx[tx].id, key: var1, obj: ctx[var1], value: ctx[var2].value }; 
            },
            __update,
            function(ctx, ret) { ctx[var1] = ret; }
        ),
        Call(
            hl2(var2 + " = update(" + tx + ".id, \"" + var2 + "\", " + var2 + ", " + var1 + ".value);"),
            function(ctx) { return { tx_key: ctx[tx].id, key: var2, obj: ctx[var2], value: ctx[var1].value }; },
            __update,
            function(ctx, ret) { ctx[var2] = ret; }
        ),
        Call(
            hl2("commit(" + tx + ".id, " + tx + ");"),
            function(ctx) { return { tx_key: ctx[tx].id, tx: ctx[tx] }; },
            __commit,
            function(ctx, ret) { }
        ),
        Call(
            hl2("clean(\"" + var1 + "\", " + var1 + ");"),
            function(ctx) { return { key: var1, obj: ctx[var1] }; },
            __clean,
            function(ctx, ret) { }
        ),
        Call(
            hl2("clean(\"" + var2 + "\", " + var2 + ");"),
            function(ctx) { return { key: var2, obj: ctx[var2] }; },
            __clean,
            function(ctx, ret) { }
        )
    ]);
}


var __tx1 = get_swap_tx("tx1", "a", "b");
var __tx2 = get_swap_tx("tx2", "b", "c");

var app_model = AppModel();
app_model.all_source = Seq([
    __clean_read,
    __update,
    __commit,
    __clean
]);
app_model.clean_read = __clean_read;
app_model.update = __update;
app_model.commit = __commit;
app_model.clean = __clean;
app_model.tx1 = ThreadModel(__tx1, app_model, "0", 182, 25);
app_model.tx2 = ThreadModel(__tx2, app_model, "1", 51, 100);
app_model.db = db;
app_model.ticked = function(thread) {
    app_model.notify();
};
module.exports = app_model;
