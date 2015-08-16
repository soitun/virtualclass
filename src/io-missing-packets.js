var ioMissingPackets = {
    executedStore: [], // It contains all executed data by current user (at receiver side)
    executedSerial: -1, // It is serial number of received/executed packet.
    missRequest: 0, // Status for Request for missed packets
    aheadPackets: [],
    //TODO - Store to IndexDB

    /**
     * 1) Check if packet is missed and request for missing packets
     * 2) If a request is already in queue, do not send more requests.
     * 3) Finally call, io.onRecJson function when queue is normal (all missing packets received).
     */
    checkMissing: function (msg) {
        "use strict";
        if (msg.m.missedpackets == 1) {
            this.fillExecutedStore(msg);
        } else if (typeof msg.m.serial != 'undefined' && msg.m.serial != null) {
            if (msg.m.serial == (this.executedSerial + 1)) {
                console.log('Displaying Object with Serial ' + msg.m.serial);
                this.executedSerial = msg.m.serial;
                this.onRecSave(msg);
                io.onRecJson(msg);
                this.executedStore[msg.m.serial] = msg;
                ioStorage.dataExecutedStoreAll(msg, msg.m.serial);

            } else if (msg.m.serial > (this.executedSerial + 1)) {
                console.log('requst miss packet');
                //we should not need the request packet when self packet is recieved
                //if(msg.user.userid != virtualclass.gObj.uid){
                var from = this.executedSerial + 1;
                this.requestMissedPackets(from, msg.m.serial, msg);
                //}

            } else { // We will not execute packets that has serial lesser then current packet but let us still store them
                console.log('no action current packet ' + this.executedSerial + ' comming at ' + msg.m.serial);
                this.executedStore[msg.m.serial] = msg;
            }
        } else {
            console.log('checkMissing should not be called without serial');
        }
    },

    requestMissedPackets: function (from, till, msg) {
        //debugger;
        if (from < 0) { // Make sure from is not negative
            from = 0;
        }

        "use strict";
        if (this.missRequest == 0) {
            // Save current packet
            this.aheadPackets.unshift(msg.m.serial);
            this.executedStore[msg.m.serial] = msg;
            till--; // We do not need to request current packet.
            console.log('request packet from ' + from + ' to ' + till);
            this.waitAndResetmissRequest();
            var sendMsg = {
                reqMissPac: 1,
                from: from,
                till: till
            };
            var tid = virtualclass.vutil.whoIsTeacher();
            ioAdapter.mustSendUser(sendMsg, tid)
        } else {
            console.log('ahead packet' + msg.m.serial);
            this.aheadPackets.unshift(msg.m.serial);
            this.executedStore[msg.m.serial] = msg;
        }
    },

    /**
     * Set missRequest variable and Reset it after delay time so that another attempt could be made
     */
    waitAndResetmissRequest: function () {
        this.missRequest = 1;
        setTimeout(function () {
            ioAdapter.missRequest = 0;
        }, 10000);
    },

    sendMissedPackets: function (msg) {
        "use strict";
        var from = msg.m.from;
        if (from < 0) { // Make sure from is not negative
            from = 0;
        }
        var till = msg.m.till + 1; // slice extracts up to but not including end.
        var senddata = ioAdapter.adapterMustData.slice(from, till);

        var sendmsg = {
            missedpackets: 1,
            data: senddata
        };

        ioAdapter.mustSendUser(sendmsg, msg.user.userid); //to user
        console.log('send packet total chunk length ' + ioAdapter.adapterMustData.length);
        //console.log('send packet ' + ' from ' +  senddata[0].serial + ' to ' + senddata[senddata.length-1].serial + 'for ' + msg.user.userid); //to user
    },

    /**
     * Fill ExecutedStore with missing packets and executed them one by one
     * If aheadPackets are available, process them
     * @param msg
     */

    fillExecutedStore: function (msg) {
        "use strict";
        //console.log('received packet');
        if(msg.m.data.length > 0){
            console.log('received packet from ' + msg.m.data[0].m.serial + ' to ' + msg.m.data[msg.m.data.length-1].m.serial);
        } else {
            console.log('empty data object' );
        }

        var dataLength = msg.m.data.length,
            i, ex;
        for (i = 0; i < dataLength; i++) {
            if(msg.m.data[i] != null){
                if (typeof msg.m.data[i].m.serial != 'undefined' || msg.m.data[i].m.serial != null) {
                    this.executedSerial = msg.m.data[i].m.serial;
                    ioStorage.dataExecutedStoreAll(msg.m.data[i], msg.m.data[i].m.serial);
                    this.onRecSave(msg.m.data[i]);
                    msg.m.data[i].user = msg.user;

                    try {
                        console.log('Displaying Object with Serial ' + msg.m.data[i].m.serial);
                        io.onRecJson(msg.m.data[i]);
                    }catch(error){
                        console.log("Error " + error);
                    }
                    this.executedStore[msg.m.data[i].m.serial] = msg.m.data[i];
                } else {
                    console.log('Recieved Packed missing serial')
                }
            }
        }

        // TODO It is possible that incoming packets are not in order
        while (ex = this.aheadPackets.pop()) {
            if (typeof ex != 'undefined' || ex != null) {
                this.executedSerial = ex;
                this.onRecSave(this.executedStore[ex]);
                console.log('Displaying Object with Serial ' + this.executedStore[ex].m.serial);
                io.onRecJson(this.executedStore[ex]);
                ioStorage.dataExecutedStoreAll(this.executedStore[ex], this.executedStore[ex].m.serial);
            } else {
                console.log('ahead Packed missing serial')
            }
        }
        this.missRequest = 0;
    },

    //save for recording process
    onRecSave: function (msg) {
        var edata = JSON.stringify(msg);
        io.onRecSave(msg, edata);
    }

};