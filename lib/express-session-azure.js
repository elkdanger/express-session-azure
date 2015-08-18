/* AzureSessionStore
    License: MIT
    Description: An express session store using Azure Storage Tables.
    Cloned from: https://github.com/Kiidzh/express-session-azure
    Modifications by Steve Hobbs (https://github.com/elkdanger)
*/

var
    azure = require("azure-storage"),
    util = require(process.binding('natives').util ? 'util' : 'sys'),
    debug = require('debug')('session-azure'),
    Session = require('express-session')
;

module.exports = AzureSessionStore;

function AzureSessionStore(options) {
    this.config = options || {};
    Session.Store.call(this, options);

    //console.dir(this.config);
    this.table = azure.createTableService(this.config.name, this.config.accessKey, this.config.host, this.config.authenticationProvider);
}

util.inherits(AzureSessionStore, Session.Store);

var p = AzureSessionStore.prototype;

p.reap = function(ms) {
    var thresh = Number(new Date(Number(new Date) - ms));
    console.log("AzureSessionStore.reap: " + thresh.toString());
};

p.get = function(sid, cb)
{
    var me = this;
    this.table.retrieveEntity('AzureSessionStore', sid, '1', function(err, result) {
        if (err) {
            //console.log("AzureSessionStore.get: " + err);
            if (err.code == "ResourceNotFound") {
                cb();
            } else if (err.code == "TableNotFound") {
                me.table.createTableIfNotExists('AzureSessionStore', function(err){
                    if (err) {
                        console.log("AzureSessionStore.get.createTableIfNotExists: " + err);
                    }
                    me.get(sid, cb);
                });
            } else {
                cb(err);
            }
        } else {
            //console.log("AzureSessionStore.get SUCCESS");
            //console.dir(result);
            delete result['.metadata']; // from azure api, don't polute final session with it
            for (var k in result) {
                try {
                    if(result[k]._.toString().indexOf("{") == 0) {
                        result[k] = JSON.parse(result[k]._);
                    } else {
                        result[k] = result[k]._;
                    }
                } catch (ex)
                {
					console.log("AzureSessionStore.get.parse: " + ex.toString());
                }
            }
            cb(null, result);
        }
    });
}

p.set = function(sid, session, cb) {
    //console.log("AzureSessionStore.set: ");
    //console.dir(session);
	var entGen = azure.TableUtilities.entityGenerator;
	var new_session = {
		PartitionKey: entGen.String(sid),
		RowKey: entGen.String('1'),
	}

    for (var k in session) {
        //if (k.indexOf("_") == 0)
            //continue; // do not copy "private" properties
        var v = session[k];
        var t = typeof v;
        switch (t) {
            case "string":
            case "number":
                new_session[k] = entGen.String(v.toString());
                break;
            case "object":
                new_session[k] = entGen.String(JSON.stringify(v));
                break;
        }
    }

    var me = this;
    this.table.insertOrReplaceEntity('AzureSessionStore', new_session, function(err, results) {
        if (err) {
            //console.log("AzureSessionStore.set: " + err);
            if (err.code == "TableNotFound") {
                me.table.createTableIfNotExists('AzureSessionStore', function(err){
                    if (err) {
                        console.log("AzureSessionStore.set.createTableIfNotExists: " + err);
                    }
                    me.set(sid, session, cb);
                });

            } else {
                cb(err.toString(), null);
            }
        } else {
            //console.log("AzureSessionStore.set SUCCESS");
            //console.dir(session);
            cb(null, session);
        }
    });
}

p.destroy = function(sid, cb) {
    this.table.deleteEntity('AzureSessionStore', { PartitionKey : sid, RowKey : '1' } , function(err){
        if(err){
            console.log("AzureSessionStore.destroy: " + err);
        }

        cb();
    });
}

p.on = function(cmd) {
    console.log("AzureSessionStore.on." + cmd);
}
