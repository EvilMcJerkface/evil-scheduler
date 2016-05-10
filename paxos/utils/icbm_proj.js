var HashVar = require("../../stepbystep/model").HashVar;

module.exports = function (value) {
    if (value!=null) {
        var signs = [];
        for (var general in value.signOffs) {
            signs.push(general);
        }
        return [{
            signOffs: signs,
            isSent: value.isSent
        }];
    }

    return null;
}