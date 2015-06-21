
mdns = require('mdns');

module.exports.Client = function () { };

module.exports.Client.prototype.createBrowser = mdns.createBrowser;
module.exports.Client.prototype.browseThemAll = mdns.browseThemAll;
module.exports.Client.prototype.udp = mdns.udp;
module.exports.Client.prototype.tcp = mdns.tcp;
