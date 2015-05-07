// This file is part of vidyamantra - http://vidyamantra.com/
/**
 * JavaScript core library for messaging
 *
 * @package    iocore
 * @copyright  2014 Pinky Sharma  {@link http://vidyamantra.com}
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

var io = {
    cfg : {},
    sock : null,
    wsuri : null,
    error : null,
    uniquesids : null,
   
    init : function(cfg, callback) {
        this.cfg = cfg;
        var that = this;
        this.wsconnect();
    },

    wsconnect : function(){
        io.wsuri = "wss://"+this.cfg.rid;
        console.log(this.cfg.rid);
        if ("WebSocket" in window) {
            this.sock = new WebSocket(io.wsuri);
        } else if ("MozWebSocket" in window) {
            this.sock = new MozWebSocket(io.wsuri);
        } else {
            console.log("Browser does not support WebSocket!");
            this.error = lang.wserror;
        }
        var scope = this;
        this.sock.onopen = function() {
            console.log("Connected to " + scope.cfg.rid);

            $.event.trigger({
                type: "connectionopen"
            });
            //authenticate user
            scope.userauthenticat();

            // user join chat room
            scope.addclient();
        }
        this.sock.binaryType = 'arraybuffer';
        this.sock.onmessage = function(e) {
            io.onRecMessage(e);
        }

        this.sock.onerror = function(e) {
            scope.error = e;
            console.log('Error:' + e);
            $.event.trigger({
                type: "error",
                message: e
            });

        }
        this.sock.onclose = function(e) {
            console.log('Connection Closed');

            $.event.trigger({
                type: "connectionclose",
                message: e.reason
            });
            console.log("Connection closed (wasClean = " + e.wasClean + ", code = " + e.code + ", reason = '" + e.reason + "')");
          //  setTimeout(function(){scope.wsconnect()}, 5000);
        }
    },

    userauthenticat : function (){
        var obj = {
            cfun  : 'authenticate',
            arg : {'authuser':this.cfg.authuser, 'authpass':this.cfg.authpass}
        }
        var jobj = JSON.stringify(obj);
        this.sock.send(jobj);
    },

    addclient : function (){
        var obj = {
            cfun : 'joinroom',
            arg : {'client':this.cfg.userid, 'roomname':this.cfg.room, 'user':this.cfg.userobj}
        }
        var jobj = JSON.stringify(obj);
        this.sock.send(jobj);
    },

    send : function(msg){
        //currTime(pag);            
        var obj = {
                //cfun : 'broadcast',
                cfun : 'broadcastToAll',
                arg : {'msg':msg}
        }
        
        if(arguments.length > 1){
            var uid = arguments[1];// user id to  whom msg is intented
            obj.arg.touser = this.uniquesids[uid];
          
        }
        var jobj = JSON.stringify(obj);
        this.sock.send(jobj);

        if(arguments.length == 1){
            //should not  be here but at init
            if(typeof fromUser == 'undefined'){
                fromUser = { 
                    lname : wbUser.lname,
                    name : wbUser.name,
                    role : wbUser.role,
                    userid : wbUser.id,
                    img : wbUser.imageurl 
                };
            }
            // STORAGE
            var storObj = {
                //cfun : 'broadcast',
                type : 'broadcastToAll',
                m : msg,
                userto : obj.arg.hasOwnProperty('touser') ? obj.arg.touser : "" ,
                user : fromUser
            }

            var storjobj = JSON.stringify(storObj);
            //getMsPckt, can not request the packets from other user during replay
            if(!msg.hasOwnProperty('sEnd') && !msg.hasOwnProperty('getMsPckt')){
                this.completeStorage(storjobj);
            }
        }
        
    },
    
    sendBinary : function (msg){
        this.sock.send(msg.buffer);
        this.dataBinaryStore(msg);
    },
    
    dataBinaryStore : function (msg){
        if(Object.prototype.toString.call(msg) == "[object Int8Array]"){
            var dtype = 'a';
            msg = vApp.dtCon.base64EncArrInt(msg);
        } else if (Object.prototype.toString.call(msg) == "[object Uint8ClampedArray]"){
            var dtype = 'c';
            msg = vApp.dtCon.base64EncArr(msg);

        }
        this.completeStorage(msg, {type : dtype});
    },
    
    sendBinary_old : function(msg){
        this.sock.send(msg.buffer);
        //2nd parameter about binary data
        var bcsv = Array.prototype.join.call(msg, ",");
        
        if(Object.prototype.toString.call(msg) == "[object Int8Array]"){
            bcsv = 'a,' + msg.length + ',' + bcsv;
        }else if(Object.prototype.toString.call(msg) == "[object Uint8ClampedArray]"){
            bcsv = 'c,' + msg.length + ',' + bcsv;
        }
        this.completeStorage(bcsv, true);
    },

    onRecMessage : function(e){
//            try{
                var scope = this;
                if(e.data instanceof ArrayBuffer){
                    $.event.trigger({
                        type: "binrec",
                        message: e.data
                    }); 
                     
                    var data_pack = new Uint8Array(e.data);
                    var msg = (data_pack[0] == 101) ?  new Int8Array(data_pack) : new Uint8ClampedArray(data_pack); 

                    this.dataBinaryStore(msg);
                }else{
//                  io.completeStorage(e.data);
                    
                    var r1 = JSON.parse(e.data);
                    if(!r1.hasOwnProperty('userto')){
                        io.completeStorage(e.data);
                    }
                    
                    if (r1.type == "joinroom"){
                        console.log("New user join room " + r1.users);
                        /* identifying new user from list*/
                        var newuser = null;
                        if(scope.uniquesids != null){
                            $.each(r1.clientids, function(i,v) {
                                if(scope.uniquesids[i] == undefined){
                                    newuser = i;
                                }
                            });
                        }
    
                        scope.uniquesids = r1.clientids;
                        //update users
                        $.event.trigger({
                            type: "member_added",
                            message: r1.users,
                            newuser:newuser
                        });
                    }
    
                    if (r1.type == "broadcastToAll"){
                        
                        console.log("json  : display msg");
                        var userto = '';
                        
                        if(r1.userto != undefined){ userto = r1.userto; }
                        
                        $.event.trigger({
                            type: "newmessage",
                            message: r1.m,
                            fromUser: r1.user,
                            toUser: userto
                        });
                    }
    
                    if (r1.type == "userleft"){
                        console.log("user logout");
                        var userto = '';
                        if(r1.userto != undefined){ userto = r1.userto; }
                        if(scope.uniquesids != null){
                            delete scope.uniquesids[r1.user.userid];
                        }
    
                        $.event.trigger({
                            type: "user_logout",
                            fromUser: r1.user,
                            message: 'offline',
                            toUser: userto
                        });
                    }
    
                    if (r1.type == "leftroom"){
                        console.log("member removed");
                        $.event.trigger({
                            type: "member_removed",
                            message: r1.users
                        });
                    }
    
                    if (r1.type == "Unauthenticated"){
                        console.log("Unauthenticated user");
                        $.event.trigger({
                            type: "authentication_failed",
                            message: 'Authentication failed'
                        });
                    }
    
                    if (r1.type == "Multiple_login"){
                        console.log("Multiple_login");
                        $.event.trigger({
                            type: "Multiple_login"
                        });
                    }
                    
                }
                
//            }catch(e){
//                console.log("Error catched   : " + e);
//                $.event.trigger({
//                    type: "error",
//                    message: e
//                });
                return;
//            }
    },
    
    disconnect:function(){
        this.sock.onclose = function () {};
        this.sock.close();
        console.log("i am closing this connection");
    }, 
    
    completeStorage : function (data, bdata, sessionEnd){
        
        if(vApp.hasOwnProperty('getContent') && vApp.getContent == true){
            return; // not store when data is fetching from indexeddb
        }
        
        if(typeof firstTime == 'undefined'){
            referenceTime = window.pageEnter;
            firstTime = true;
            
            if(!vApp.vutil.isPlayMode()){
                var t = vApp.storage.db.transaction(['allData'], "readwrite");
                if(typeof t != 'undefined'){
                    //should check first row is authuser/authpass
                    // clear if differnt else leave as it is
                    var objectStore = t.objectStore('allData');
                    objectStore.openCursor().onsuccess = function (event){
                        var cursor = event.target.result;
                        if (cursor) {
                            if(cursor.value.hasOwnProperty('recObjs')){
                                if(!cursor.value.hasOwnProperty('bd')){
                                    var recObs = JSON.parse(cursor.value.recObjs);
                                    if(!recObs.hasOwnProperty('authuser')){
                                        objectStore.clear();
                                    }
                                }else{
                                    objectStore.clear();
                                } 
                            }
                        }
                    };
                }
            }
        }

        var currTime = new Date().getTime();
        var playTime = currTime - referenceTime;
        
        if(typeof sessionEnd != 'undefined'){
            //undefined for data and bindary data
            vApp.storage.completeStorage(playTime, undefined, undefined, sessionEnd)
        }else{
            (typeof bdata == 'undefined') ? vApp.storage.completeStorage(playTime, data) : vApp.storage.completeStorage(playTime, data, bdata);
        }
        
        
        referenceTime = currTime;
    }
};



