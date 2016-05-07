var HashVar = require("../../stepbystep/model").HashVar;

module.exports = function (value) {
    if (value!=null) {
        var signs = [];
        for (var general in value.signs) {
            signs.push(general);
        }
        return [{
            signs: signs,
            signed: value.signed
        }];
    }

    return null;
}