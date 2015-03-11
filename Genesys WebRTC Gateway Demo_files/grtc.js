/*!
 * @license Genesys WebRTC Service JSAPI
 * @version 1.0.2
 * Copyright (c) 2014 Genesys Telecommunications Laboratories, Inc.
 * All rights reserved.
 */

/*!
 * Portions of this software is based on http://code.google.com/p/webrtc-samples/
 * and it is covered by the following:
 *
 * Copyright (C) 2012 Google.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of Google nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL GOOGLE BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * Wrap everything in an anonymous closure and export Grtc as the only global.
 */
(function (window, navigator, document, $, undefined) {

"use strict";

/*jslint browser: true, bitwise: true, eqeq: false, plusplus: true, unparam: true, vars: true, white: true, maxerr: 200 */

window.onerror = function(message, url, line) {
    console.log("window.onerror: message = " + message + ", url = " + url + ", line = " + line);
};

// -------------------- adaptor.js polyfill --------------------

/* This section generalizes the API across different browsers for
 * using WebRTC functionality. It is based on the adaptor.js
 * polyfill from http://code.google.com/p/webrtc-samples/. */

navigator.getUserMedia = (
    navigator.mozGetUserMedia ||    // firefox API
    navigator.webkitGetUserMedia    // chrome API
);

var URL = (
    window.URL ||
    window.webkitURL
);

var RTCPeerConnection = function(pcConfig, pcConstraints) {
    if (window.mozRTCPeerConnection) {
        return new mozRTCPeerConnection(pcConfig, pcConstraints);
    } else if (window.webkitRTCPeerConnection) {
        return new webkitRTCPeerConnection(pcConfig, pcConstraints);
    } else {
        return null;
    }
};

var RTCSessionDescription = (
    window.mozRTCSessionDescription ||
    window.RTCSessionDescription
);

var RTCIceCandidate = (
    window.mozRTCIceCandidate ||
    window.RTCIceCandidate
);

var MediaStream = (
    window.MediaStream ||
    window.webkitMediaStream
);

// all the required objects should have been defined

if (MediaStream && MediaStream.prototype && !MediaStream.prototype.getAudioTracks) {
    // getViewTracks method not defined
    if (MediaStream.prototype.audioTracks) {
        // audioTracks property is defined: chrome 25 or lower
        MediaStream.prototype.getAudioTracks = function() {
            return this.audioTracks;
        };
    } else {
        // firefox or others
        MediaStream.prototype.getAudioTracks = function() {
            return [];
        };
    }
}

if (MediaStream && MediaStream.prototype && !MediaStream.prototype.getVideoTracks) {
    // getViewTracks method not defined
    if (MediaStream.prototype.videoTracks) {
        // videoTracks property is defined: chrome 25 or below
        MediaStream.prototype.getVideoTracks = function() {
            return this.videoTracks;
        };
    } else {
        // firefox or others
        MediaStream.prototype.getVideoTracks = function() {
            return [];
        };
    }
}

// -------------------- END of adaptor.js polyfill --------------------

// -------------------- Class Grtc --------------------

// This is the Grtc class and the only variable to be exported
// It is a singleton class and is not supposed to be instantiated
var Grtc = {};

// When an error is thrown by Grtc code, these are the keywords for the client
// to identify what error has happened
Grtc.CONFIGURATION_ERROR         = "CONFIGURATION_ERROR";
Grtc.CONNECTION_ERROR            = "CONNECTION_ERROR";
Grtc.WEBRTC_NOT_SUPPORTED_ERROR  = "WEBRTC_NOT_SUPPORTED_ERROR";
Grtc.WEBRTC_ERROR                = "WEBRTC_ERROR";
Grtc.INVALID_STATE_ERROR         = "INVALID_STATE_ERROR";
Grtc.NOT_READY_ERROR             = "NOT_READY_ERROR";
Grtc.GRTC_ERROR                  = "ERROR";   // Generic error
Grtc.GRTC_WARN                   = "WARNING"; // Generic warning

/* Static method to check whether WebRTC is supported by a browser. */
Grtc.isWebrtcSupported = function () {
    if (window.mozRTCPeerConnection || window.webkitRTCPeerConnection) {
        return true;
    } else {
        return false;
    }
    //return !!RTCPeerConnection;
};

/* Static method to detect WebRTC supported browser. */
Grtc.getWebrtcDetectedBrowser = function () {
    if (navigator.mozGetUserMedia) {
        return "firefox";
    } else if (navigator.webkitGetUserMedia) {
        return "chrome";
    } else {
        return null;
    }
};

/* Static method to detect WebRTC supported browser version. */
Grtc.getWebrtcDetectedVersion = function () {
    if (navigator.mozGetUserMedia) {
        return parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
    } else if (navigator.webkitGetUserMedia) {
        return parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
    } else {
        return null;
    }
};

/* Provides standard resolutions like QVGA, VGA, HD etc capsulated in constraints format
 * for user convenience.
 * For example to enable local media with audio and HD video - call the enableMediaSource() in
 * Grtc.Client like the following - 
 * enableMediaSource(true,Grtc.VideoConstraints.hd());
 */
Grtc.VideoConstraints = {
    qvga: function () {
        return {
            mandatory: {
                maxWidth: 320,
                maxHeight: 180
            }
        };
    },
    vga: function () {
        return {
            mandatory: {
                maxWidth: 640,
                maxHeight: 360
            }
        };
    },
    hd: function () {
        return {
            mandatory: {
                minWidth: 1280,
                minHeight: 720
            }
        };
    },
    custom: function (width, height) {
        return {
            mandatory: {
                minWidth: width,
                minHeight: height
            }
        };
    },
    screen: function (width, height, maxframerate, minframerate) {
        if (typeof width === "undefined") {
            width = screen.width;
        }
        if (typeof height === "undefined") {
            height = screen.height;
        }
        if (typeof maxframerate === "undefined") {
            maxframerate = 5;              // Seems good enough for screen
        }
        if (typeof minframerate === "undefined") {
            minframerate = 1;
        }
        if (maxframerate < minframerate) {
            gLogger.log(Grtc.GRTC_WARN + ": Grtc.VideoConstraints.screen() - " +
                "argument maxFrameRate (" + maxframerate + ") is less than " +
                "minFrameRate (" + minframerate + ")");
            maxframerate = minframerate;
        }
        return {
            mandatory: {
                chromeMediaSource: 'screen',
                maxWidth: width,
                maxHeight: height,
                maxFrameRate: maxframerate,
                minFrameRate: minframerate
            },
            optional: []
        };
    }
};

/* Decode a query-string into an object and return it. */
Grtc.deparam = function(query) {
    var params = {},
        seg = query.replace(/\n/g,'').split('&'),
        len = seg.length, i, s;
    for (i = 0; i < len; i++) {
        if (seg[i] && seg[i].search("=") > 0) { 
            s = seg[i].split('=');
            params[s[0]] = s[1];
        }
    }
    return params;
};

// -------------------- Utility functions --------------------

/* Utility (private) function to generate a 36-character sequence. */
function generateUUID () {
    var maxInt = 2147483647; // Math.pow(2,31)-1
    // Number of milliseconds since 1970-01-01 (should be greater than maxInt)
    var timestamp = new Date().getTime();
    var uuid = "anonxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g,
        function (c) {
            // Takes the 4 least significant bits of timestamp (plus a random additive)
            var randomN = (timestamp + Math.random()*maxInt) & 0xf;
            // Prepare for the next round (note: using shift operator may cause
            // lost of information since shift in javascript works on 32bit number
            // and timestamp is greater than that)
            timestamp = timestamp / 2 | 0;
            // Replace x with randomN and y with 1--- where - is one of the
            // 3 least significant bits of randomN (use base16 representation)
            return (c === "x" ? randomN : (randomN & 0x7 | 0x8)).toString(16);
        }
    );
    return uuid;
}

// -------------------- Class Grtc.Logger --------------------

/* Logger class used to log error messages.
 * Not making it a closure since there is not much to encapsulate. */
Grtc.Logger = function (e) {
    // The HTML container element the logs should be sent to.
    // If set to null or invalid, logs are sent to web console by default
    this.element = null;
    if (e && e.nodeType) {
        this.element = e;
    }
};

/* Log message to the container element if valid; otherwise log to console.
 * If exception object is specified, its description field is also logged. */
Grtc.Logger.prototype.log = function (message, exception) {
    var s = "grtc";
    if (window.performance && window.performance.now) {
        s += (": " + (window.performance.now() / 1000).toFixed(3));
    }
    if (message) {
        s += (": " + message);
    }
    if (exception && exception.message) {
        s += (": " + exception.message);
    }

    if (this.element && (typeof this.element.innerHTML === "string")) {
        this.element.innerHTML += (s + "<br/>");
    } else {
        if (window.console && window.console.log) {
            window.console.log(s);
        }
    }
};

// default logger used by Grtc internally
var gLogger = new Grtc.Logger();

/* User can set gLogger to another instance of Grtc.Logger. */
Grtc.setLogger = function (logger) {
    if (logger && (logger.constructor === Grtc.Logger)) {
        gLogger = logger;
    }
};

// -------------------- END of Class Grtc.Logger --------------------

// -------------------- Class Grtc.Error --------------------

/* Error class used to customize errors thrown by Grtc functions.
 * Not making it a closure since there is not much to encapsulate. */
Grtc.Error = function (t, m) {
    this.name = (typeof t === "undefined") ? Grtc.GRTC_ERROR : t; 
    this.message = "";
    if (m) {
        this.message = m;
    }
};

// -------------------- END of Class Grtc.Error --------------------

var CALL_STATE_NOT_STARTED = 0;
var CALL_STATE_ONGOING     = 1;

// -------------------- Class Grtc.Client ---------------------------

/*
 * The Grtc Client class represents a user agent (browser) that can
 * register/connect/disconnect against the WebRTC gateway with a SIP Server,
 * and make a call to a client or SIP endpoint that has registered with
 * the SIP Server, or accept a call from another client or SIP endpoint.
 * Register involves registering with the SIP Server via the gateway,
 * while connect uses an arbitrary UUID to register with the gateway only.
 * To be able to receive a call, you would need to use register.
 *
 * The client could only manage one register or connect at a time, though it
 * allows disconnecting and registering/connecting again with a different ID.
 * It could also manage only one call at a time, though another call could be 
 * made after terminating the the existing call.  Multiple concurrent calls
 * could be had with multiple instances of the grtc client, however.
 *
 * This class is encapsulated in an anonymous closure and exported as a
 * property of Grtc.  The following member variables are used.
 *
 * - configuration: contains a list of mandatory and optional properties
 *     used to establish connection with the WebRTC gateway.
 * - localStream  : local audio and/or video stream obtained via getUserMedia.
 * - publicId     : a unique ID for connecting with the gateway anonymously.
 * - registeredSSID: unique Server-Side ID received from Gateway on sign-in.
 * - mediaSession : a reference to the Grtc.MediaSession instance.
 * - pcCaller     : caller ID of incoming call, available till call is handled;
 *     if call is accepted, this ID will be set in pcDest of mediaSession.
 * - incomingMsg  : incoming offer message, processed by mediaSession.acceptCall.
 * - audioConstraints/videoConstraints: media constraints used with getUserMedia,
 *     and could be optionally set by enableMediaSource.
 * - noansTimeout : no-answer timeout value, which can be set in configuration.
 * - disconnecting: a flag indicating that a disconnect is in progress.
 */
(function () {

var GRTC_PARAMETERS = [
    "webrtc_gateway",
    "stun_server",
    "turn_server",
    "turn_username",
    "turn_password",
    "sip_username",
    "sip_password",
    "dtls_srtp",
    "noanswer_timeout"
];

// This is the Grtc.Client class to be exported
var gClient = function (configObj) {
    // configObj is the configuration object that should contain some
    // mandatory properties and optional properties. Need to check it
    // is well formed
    var isWellFormed = true;
    if (configObj && typeof configObj === "object") {
        // "webrtc_gateway" is mandatory
        if (!configObj.hasOwnProperty("webrtc_gateway")) {
            gLogger.log(Grtc.CONFIGURATION_ERROR +
                ": mandatory parameter is not specified: webrtc_gateway");
            isWellFormed = false;
        }
       
        // turn_username and turn_password needed when turn_server is specified
        if (configObj.hasOwnProperty("turn_server")) {
            if (!configObj.hasOwnProperty("turn_username")) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter must be specified: turn_username");
                isWellFormed = false;
            }
            if (!configObj.hasOwnProperty("turn_password")) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter must be specified: turn_password");
                isWellFormed = false;
            }
        }

        // each property defined in configObj shall be valid
        var p;
        for (p in configObj) {
            if ($.inArray(p, GRTC_PARAMETERS)<0) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter specified is not valid: " + p);
                isWellFormed = false;
            }
        }
    } else {
        isWellFormed = false;
    }

    if (isWellFormed) {
        this.configuration = configObj;
    } else {
        gLogger.log(Grtc.CONFIGURATION_ERROR +
            ": configuration object is not well formed");
        throw new Grtc.Error(Grtc.CONFIGURATION_ERROR,
            "configuration object is not well formed");
    }

    // Local audio and/or video stream object obtained via getUserMedia.
    this.localStream = null;
    
    // An arbitrary unique ID for connecting with the gateway anonymously.
    this.publicId = generateUUID();
    
    // Unique Server-Side ID received from Gateway on sign-in.
    this.registeredSSID = -1; 
    
    // The Grtc.MediaSession instance used for a media call.
    this.mediaSession = null;
    
    // Caller ID of an incoming call, available till call is processed.
    this.pcCaller = null;
    
    // Used to save an incoming offer message, which will be processed by
    // onIncomingCall handler by calling acceptCall on the mediaSession.
    this.incomingMsg = null;

    // Default access permissions to local audio and video streams.
    // These could be optionally overwritten by enableMediaSource().
    this.audioConstraints = true;
    this.videoConstraints = true; //{"mandatory": {}, "optional": []};
    
    // Video bandwidth value to be set in SDP using b=AS field. It's in Kbps.
    // Note: setting this may not work with Firefox currently.
    this.bandwidthVideo = 500;
    
    // Set to true if new ICE candidates are expected due to a media type added
    // for the first time using gUM. It's used to avoid a Chrome (v33) bug with
    // iceGatheringState, which seems fixed in Canary v35.
    this.candidatesExpected = false;
    // These remember if audio/video is enabled at least once - used for setting
    // candidatesExpected.
    this.audioEnabledOnce = false;
    this.videoEnabledOnce = false;
    
    // Minimum noanswer from peer timeout is set to 18s (3-rings).
    // Default for this configuration is set to 60s.
    this.noansTimeout = 60000;
    if (configObj.hasOwnProperty("noanswer_timeout")) {
        var temp = parseInt(configObj.noanswer_timeout, 10);
        if ($.isNumeric(temp) && temp >= 18000) {
            this.noansTimeout = temp;
        }
    }
    
    this.disconnecting = false;     // True when a disconnect is in progress.
    
    // The following callback events are supported. One or more handlers could
    // be added with each of these by the user to handle the associated event.
    // The "unique" flag makes sure a function is not added multiple times,
    // while "stopOnFalse" avoids calling functions added later when one
    // returns false (calling order is the same as the added order).
    this.onConnect      = $.Callbacks("unique stopOnFalse");
    this.onRegister     = $.Callbacks("unique stopOnFalse");
    this.onFailed       = $.Callbacks("unique stopOnFalse");
    this.onDisconnect   = $.Callbacks("unique stopOnFalse");
    this.onMediaSuccess = $.Callbacks("unique stopOnFalse");
    this.onMediaFailure = $.Callbacks("unique stopOnFalse");
    this.onIncomingCall = $.Callbacks("unique stopOnFalse");
    this.onInvite       = $.Callbacks("unique stopOnFalse");
    this.onPeerClosing  = $.Callbacks("unique stopOnFalse");
    this.onPeerNoanswer = $.Callbacks("unique stopOnFalse");
    this.onInfoFromPeer = $.Callbacks("unique stopOnFalse");
    this.onGatewayError = $.Callbacks("unique stopOnFalse");
};

/* Send the sign_in request: common for connect and register. */
function doConnect (objClient) {
    var objGet = null;
    try {
        var queryurl = objClient.configuration.webrtc_gateway +
            "/sign_in?" + objClient.publicId;
        gLogger.log("Initializing: " + queryurl);
        objGet = $.get(queryurl, function (data) {
            try {
                var peers = data.split("\n");
                objClient.registeredSSID = peers[0].split("=")[1];
                gLogger.log("Server-Side ID: " + objClient.registeredSSID);
                startHangingGet(objClient);
            } catch (e) {
                // Originally thought throwing an error here is sufficient.
                // It turned out not working since we do not control who
                // triggers "onreadystatechange" event (guess the browser?)
                // so the error was not caught properly

                // So instead, we can notify the client by firing an event;
                // and the client is expected to handle the event by notifying
                // the user about the error

                // One method is to use DOM events handling:
                // createEvent/initEvent/dispatchEvent plus client side
                // handling using addEventListener. The jQuery equivalent
                // are methods trigger/on

                // To avoid DOM events on the library side, it is recommended to use
                // $.Callbacks plus fire/add in jQuery
                gLogger.log("Connection attempt to WebRTC Gateway has failed", e);
                objClient.onFailed.fire({
                    message: "Connection attempt to WebRTC Gateway has failed"
                });
            }
        });
    } catch (e) {
        gLogger.log(Grtc.CONNECTION_ERROR + ": sign-in failed", e);
        throw new Grtc.Error(Grtc.CONNECTION_ERROR, "exception during sign-in");
    }
    return objGet;
}

/* Send the sign_in request: common for connect and register. */
function doAuthenticate (objClient) {
    var objGet = null;
    try {
        var queryurl = objClient.configuration.webrtc_gateway + "/sign_in";
        var postData = objClient.publicId + ":" + objClient.configuration.sip_password;
        gLogger.log("Initializing: " + queryurl); // we don't print password
        objGet = $.post(queryurl, postData, function (data) {
            try {
                var peers = data.split("\n");
                objClient.registeredSSID = peers[0].split("=")[1];
                gLogger.log("Server-Side ID: " + objClient.registeredSSID);
                startHangingGet(objClient);
            } catch (e) {
                // Originally thought throwing an error here is sufficient.
                // It turned out not working since we do not control who
                // triggers "onreadystatechange" event (guess the browser?)
                // so the error was not caught properly

                // So instead, we can notify the client by firing an event;
                // and the client is expected to handle the event by notifying
                // the user about the error

                // One method is to use DOM events handling:
                // createEvent/initEvent/dispatchEvent plus client side
                // handling using addEventListener. The jQuery equivalent
                // are methods trigger/on

                // To avoid DOM events on the library side, it is recommended to use
                // $.Callbacks plus fire/add in jQuery
                gLogger.log("Connection attempt to WebRTC Gateway has failed", e);
                objClient.onFailed.fire({
                    message: "Connection attempt to WebRTC Gateway has failed"
                });
            }
        });
    } catch (e) {
        gLogger.log(Grtc.CONNECTION_ERROR + ": authentication failed", e);
        throw new Grtc.Error(Grtc.CONNECTION_ERROR, "exception during authentication");
    }
    return objGet;
}

/* Connect to WebRTC gateway using a arbitrary UUID. */
gClient.prototype.connect = function () {
    this.disconnect();      // Disconnect first, in case we are already registered.
    
    var self = this;

    // Send the sign_in request
    var objGet = doConnect(this);

    // Notify the client by firing an event; the client can handle the
    // event by making a call
    if (objGet) {
        objGet.done(function () {
            self.onConnect.fire({
                message: "Connection attempt to WebRTC Gateway is successful"
            });
        }).fail(function () {
            self.onFailed.fire({
                message: "Connection attempt to WebRTC Gateway has failed"
            });
            gLogger.log(Grtc.CONNECTION_ERROR + ": connection failed");
        });
    }
};

/* Disconnect from WebRTC gateway. */
gClient.prototype.disconnect = function () {
    doSignOut(this);

    // Reset publicId
    this.publicId = generateUUID();

    this.onDisconnect.fire({
        message: "Client is disconnected from WebRTC Gateway"
    });
};

/* register is fundamentally connect but with a user specified ID (localId argument). 
 * If sip_username is specified in configuration and localId argument is not specified, 
 * then sip_username is used as publicId. */
gClient.prototype.register = function (localId) {
    // Always disconnect first, in case we are already registered.
    this.disconnect();
    // The difference between register and connect is that register has a
    // user specified ID while connect is using a randomly generated ID
    if (typeof localId !== 'undefined') {
        this.publicId = localId;
    } else if (this.configuration.sip_username) {
        this.publicId = this.configuration.sip_username;
    } else {
        gLogger.log(Grtc.GRTC_ERROR + ": user specified id missing for registration");
        throw new Grtc.Error(Grtc.GRTC_ERROR, "user specified id missing for registration");
    }

    var self = this;

    // Send the sign_in request
    var objGet = null;
    if (this.configuration.sip_password) {
        // authenticate
        objGet = doAuthenticate(this);
    } else {
        // without authentication
        objGet = doConnect(this);
    }

    objGet.done(function () {
        self.onRegister.fire({
            message: "Registration attempt to WebRTC Gateway is successful"
        });
    }).fail(function () {
        self.onFailed.fire({
            message: "Registration attempt to WebRTC Gateway has failed"
        });
        gLogger.log(Grtc.CONNECTION_ERROR + ": registration failed");
    });
};

/* Ask the user to grant access to camera and microphone
 * audioConstraints (optional): true (default), false, or an object
 * videoConstraints (optional): true (default), false, or an object
 *
 * This functionality will be moved to MediaSession in the future. */
gClient.prototype.enableMediaSource = function (audioConstraints, videoConstraints) {
    var self = this;

    // Save user specified constraints for later use.
    // Default is true for both constraints.
    // Also, set candidatesExpected flag for Chrome version < 35, used to workaround
    // a bug that iceGatheringState in PC isn't set correct - found in version 33
    // but not 35 canary, and not sure if it's in 34; however, it should work
    // for all versions, albeit with some additional delay in response.
    var browserVersion = Grtc.getWebrtcDetectedVersion();
    gLogger.log("Browser version: " + browserVersion);
    if (Grtc.getWebrtcDetectedBrowser() !== "chrome" || browserVersion === null) {
        browserVersion = Infinity;
    }
    if (typeof audioConstraints !== "undefined") {
        if (browserVersion < 35) { 
            if (this.audioEnabledOnce === false) {
                if (audioConstraints === true) {
                    this.candidatesExpected = true;
                    this.audioEnabledOnce = true;
                }
            }
        }
        this.audioConstraints = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        if (browserVersion < 35) { 
            if (this.videoEnabledOnce === false) {
                if (videoConstraints === true) {
                    this.candidatesExpected = true;
                    this.videoEnabledOnce = true;
                }
            }
        }
        this.videoConstraints = videoConstraints;
    }

    // User specified constraints will be passed to getUserMedia directly
    var mediaConstraints = {audio: this.audioConstraints, video: this.videoConstraints};
    gLogger.log("Requested access to local media with mediaConstraints: " + 
                JSON.stringify(mediaConstraints));

    try {
        // Using new permission format
        navigator.getUserMedia(
            mediaConstraints,
            function (s) {
                // If mediaSession exists, remove the old stream, add the new one to PC.
                // removeStream() isn't supported by Firefox now, and addStream() for a
                // 2nd time also generates an error; however, new stream still works.
                if (self.mediaSession !== null) {
                    try {
                        if (self.localStream) {
                            self.localStream.stop();
                            self.mediaSession.peerConnection.removeStream(self.localStream);
                        }
                    } catch (e) {
                        gLogger.log(Grtc.GRTC_ERROR + ": Failed to remove local stream", e);
                    }
                    try {
                        self.mediaSession.peerConnection.addStream(s);
                    } catch (e) {
                        gLogger.log(Grtc.GRTC_ERROR + ": Failed to update local stream in PC", e);
                    }
                }
                self.localStream = s;
                gLogger.log("User has granted access to local media");
                self.onMediaSuccess.fire({
                    stream: s
                });
            },
            function (gumError) {
                gLogger.log(Grtc.GRTC_ERROR + ": Attempt to access local media has failed: " +
                            JSON.stringify(gumError));
                self.onMediaFailure.fire({
                    message: "Attempt to access local media has failed"
                });
            }
        );
    } catch (e) {
        gLogger.log(Grtc.GRTC_ERROR + ": Attempt to access local media has failed",e);
        self.onMediaFailure.fire({
            message: "Attempt to access local media has failed"
        });
    }
};

/* Stop the local media source. */
gClient.prototype.disableMediaSource = function () {
    if (this.localStream !== null) {
        gLogger.log("Removing access to local media");
        if (this.mediaSession) {
            removeLocalStreams(this.mediaSession);
        }
        this.localStream.stop();
        this.localStream = null;
    }
};

/* Set the HTML container element (sink) for the specified media stream.
 * element: the <audio> or <video> container element of the media
 * stream: the stream to be attached
 */
gClient.prototype.setViewFromStream = function (element, stream) {
    if (element && element.nodeType && stream) {
        if (typeof element.srcObject !== 'undefined') {
            // eventually both chrome and firefox will support this
            element.srcObject = stream;
            element.play();
        } else if (typeof element.mozSrcObject !== 'undefined') {
            // current firefox way
            element.mozSrcObject = stream;
            element.play();
        } else if (typeof element.src !== 'undefined') {
            // current chrome way: treat it as default
            var url = URL.createObjectURL(stream);
            element.src = url;
        } else {
            gLogger.log(Grtc.NOT_READY_ERROR + ": setViewFromStream: " +
                "unable to attach stream to the specified element " +
                JSON.stringify(element));
        }
    } else {
        gLogger.log(Grtc.NOT_READY_ERROR + ": setViewFromStream failed");
        throw new Grtc.Error(Grtc.NOT_READY_ERROR, "exception during setViewFromStream");
    }


};

/* Filter out unneeded ICE candidates from the given list, and return the ones
 * that would be sent to the remote peer in an offer or answer message.
 * This default implementation would not filter any, and return all candidates.
 * This, however, could be overwritten by the user with another implementation.
 *
 * This is defined in client instead of media session, as it does not use
 * any member variables, and this could be overwritten in one place when the
 * client instance is created, instead of overwriting this every place where a
 * media session instance is created.
 */
gClient.prototype.filterIceCandidates = function(Candidates) {
    return Candidates;
};

gClient.prototype.setVideoBandwidth = function (bandwidth) {
    if (typeof bandwidth === "number" ) {
        this.bandwidthVideo = bandwidth;
    }
};

// Export Grtc.Client
Grtc.Client = gClient;

})();

// -------------------- END of Class Grtc.Client --------------------


// -------------------- Class Grtc.MediaSession --------------------

/*
 * The MediaSession class is encapsulated in an anonymous closure and
 * exported as a property of Grtc.
 */
(function () {

var gMediaSession = function (client) {
    this.grtcClient = client;
    this.sessionId = ++Grtc.MediaSession.sessionId;
    this.otherSessionId = null;
    this.pcDest = null;                         // PeerConnection destination DN
    this.sequenceNumber = 0;
    this.callState = CALL_STATE_NOT_STARTED;
    this.state = "new";
    this.remoteStreamAdded = false;             // True after onaddstream called
    this.actionNeeded = false;
    this.iceStarted = false;
    this.moreIceComing = true;
    this.localCandidates = [];
    this.outSDP = null;
    this.dataToAttach = null;
    this.dataAttached = null;
    this.offerToReceiveAudioInOffer  = true;
    this.offerToReceiveVideoInOffer  = true;
    this.offerToReceiveAudioInAnswer = true;
    this.offerToReceiveVideoInAnswer = true;
    this.dtmfSender = null;
    this.checkNoanswer = null;
    this.onHold = false;

    this.onRemoteStream = $.Callbacks("unique stopOnFalse");

    if (client) {
        client.mediaSession = this;
    }
    var self = this;

    var conf = this.grtcClient.configuration;
    var iceServers = [];
    // add stun server to the list of ice servers if it is available
    if (conf.stun_server) {
        iceServers.push({"url": "stun:" + conf.stun_server});
    }
    // add turn server to the list of ice servers if it is available
    if (conf.turn_server && conf.turn_username && conf.turn_password) {
        // turn config format on chrome changed in M28
        var browserVersion = Grtc.getWebrtcDetectedVersion();
        var url = "turn:";
        if (Grtc.getWebrtcDetectedBrowser() === "chrome" &&
            browserVersion !== null && browserVersion < 28) {
            // chrome version 27 or lower
            url += (conf.turn_username + "@" + conf.turn_server);
            iceServers.push({"url": url, "credential": conf.turn_password});
        } else {
            // firefox, or chrome version 28 or higher
            url += conf.turn_server;
            iceServers.push({"url": url, "credential": conf.turn_password,
                "username": conf.turn_username});
        }
    }
    gLogger.log("Creating RTCPeerConnnection with ICE configuration: " +
        JSON.stringify(iceServers));
    // create a peer connection - check for DTLS-SRTP config
    // Currently Chrome only allows DtlsSrtpKeyAgreement as an optional constraint for PC
    // Later we may need to change it to mandatory based on Chrome update
    // We set DtlsSrtpKeyAgreement to false by default for now
    var pcConstraints = {"optional": [{"DtlsSrtpKeyAgreement": false}]};
    if (conf.dtls_srtp && (conf.dtls_srtp === 'true' || conf.dtls_srtp === true)) {
        pcConstraints = {"optional": [{"DtlsSrtpKeyAgreement": true}]};
    }
    gLogger.log("PeerConnection constraints: " + JSON.stringify(pcConstraints));

    try {
        this.peerConnection = new RTCPeerConnection({"iceServers": iceServers},pcConstraints);
    } catch (e) {
        gLogger.log(Grtc.WEBRTC_NOT_SUPPORTED_ERROR +
            ": construction of RTCPeerConnection object failed", e);
        throw new Grtc.Error(Grtc.WEBRTC_NOT_SUPPORTED_ERROR, e.message);
    }

    if (this.grtcClient.localStream !== null) {
        // Add local stream as PC is created
        try {
            this.peerConnection.addStream(this.grtcClient.localStream);
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": Failed to add local stream to PC", e);
        }
        // Create DTMFSender for PC - currently supported for Chrome only
        if (navigator.webkitGetUserMedia) {
            try {
                var local_audio_track = this.grtcClient.localStream.getAudioTracks()[0];
                this.dtmfSender = this.peerConnection.createDTMFSender(local_audio_track);
                gLogger.log("Created DTMF Sender");
            } catch (e) {
                gLogger.log(Grtc.GRTC_ERROR + ": Failed to Create DTMF Sender", e);
                this.dtmfSender = null;
            }
        }
    }        

    // ICE candidates callback
    this.peerConnection.onicecandidate = function (event) {
        if (event.candidate) {
            // This log is for debugging only.
            //gLogger.log("ICE candidate[" + event.candidate.sdpMid + "]: " +
            //    event.candidate.candidate);
            self.localCandidates.push(event.candidate);
        } else {
            // NOTE: At the moment, we do not renegotiate when new candidates
            // show up after the more flag has been false once
            self.iceStarted = false;
            if (self.moreIceComing) {
                gLogger.log("ICE gathering completed");
                self.moreIceComing = false;
                self.markActionNeeded();
            }
        }
    };

    // Fired as a result of setRemoteDescription.  Note, this has nothing to do
    // with addStream() method of peerConnection, which is used for local stream.
    // WebRTC Spec 1.0: "This callback does not wait for a given media stream to
    // be accepted or rejected via SDP negotiation."
    this.peerConnection.onaddstream = function (mediaStreamEvent) {
        try {
            gLogger.log("Access to remote stream");
            self.remoteStreamAdded = true;
            self.onRemoteStream.fire({ stream: mediaStreamEvent.stream });
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": onRemoteStream event handling failed", e);
        }
        mediaStreamEvent.stream.onended = function () {
            gLogger.log("Remote stream ended");
        };
        mediaStreamEvent.stream.onaddtrack = function (track) {
            gLogger.log("Remote stream has changed");
            self.onRemoteStream.fire({ stream: mediaStreamEvent.stream });
        };
    };
    
    this.peerConnection.onremovestream = function (mediaStreamEvent) {
        gLogger.log("onremovestream() called");
    };
    
    /* Do we need this?
    this.peerConnection.onnegotiationneeded = function (event) {
        gLogger.log("onnegotiationneeded() called");
    };
    
    this.peerConnection.onsignalingstatechange = function (event) {
        gLogger.log("onsignalingstatechange() called");
    };
    */
};

/* Remove the local media streams from the PeerConnection of given media session. */
function removeLocalStreams (objSession) {
    if (objSession.peerConnection && objSession.grtcClient.localStream !== null) {
        gLogger.log("Removing local streams from PC");
        try {
            objSession.peerConnection.removeStream(objSession.grtcClient.localStream);
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": Failed to remove local stream", e);
        }
    }
};

/*
 * Sends one or multiple DTMF tones [0-9],*,#,A,B,C,D
 * tones - string composed by one or multiple valid DTMF symbols
 * options - fields in options object:
 *           duration: default 100ms. The duration cannot be more than 6000 ms or less than 70 ms.
 *           tonegap:  the gap between tones. It must be at least 50 ms. The default value is 50 ms. 
 * We don't check for validity of the options fields, the WebRTC API validates this
 * returns 0 for success, -1 for failure
 */
gMediaSession.prototype.sendDTMF = function(tones, options) {
    if (this.dtmfSender === null) {
        gLogger.log("DTMF Sender is NULL");
        return -1;
    }
    if (tones === null || tones.length === 0) {
        gLogger.log("No DTMF tones specified for sending");
        return -1;
    }
    var duration = 100;
    var tonegap  = 50;
    if (options.tonegap) {
        tonegap = options.tonegap;
    }
    if (options.duration) {
        duration = options.duration;
    }
    try {
        this.dtmfSender.insertDTMF(tones, duration, tonegap);
        gLogger.log("DTMF tones sent - " + tones);
        return 0;
    } catch(e) {
        gLogger.log(Grtc.GRTC_ERROR + ": DTMF tone sending failed", e);
        return -1;
    }
};

/* Prepare for ICE gathering by initializing the relevant flags.
 * Note, ICE gathering starts when createOffer or createAnswer is called,
 * so this should be called before calling one of those.
 */
gMediaSession.prototype.prepareForIceGathering = function () {
    if (!this.iceStarted) {
        gLogger.log("ICE candidate gathering initialized");
        this.iceStarted = true;
        this.moreIceComing = true;
    }
};

/* Set video bandwidth in given SDP using b=AS:<value> field in video m-line, 
 * and return the modified SDP.
 */
function setVideoBandwidthInSDP(sdpStr, bandwidth) {
    if (bandwidth > 0) {
        return sdpStr.replace(/m=video .*\r\n/i, 
                              "$&" + "b=AS:" + bandwidth + "\r\n");
    } else {
        return sdpStr;
    }
}

/* This function processes signalling messages from the other side.
 * @param {string} msgstring JSON-formatted string containing a ROAP message.
 */
gMediaSession.prototype.processSignalingMessage = function (msgstring) {
    gLogger.log("processSignalingMessage: " + msgstring);
    var startJSON = msgstring.search("{");
    if (startJSON > 0) {
        msgstring = msgstring.substr(startJSON);
    }
    var msg;
    try {
        msg = JSON.parse(msgstring);
    } catch (e) {
        // MWA-328: received unexpected message, ignore for now
        gLogger.log(Grtc.GRTC_WARN + ": JSON.parse exception ignored: ", e);
        return;
    }

    this.incomingMessage = msg;
    gLogger.log("processSignalingMessage(type=" +
        msg.messageType + ", state=" + this.state + ")");

    // Handle incoming attached data
    if (msg.attacheddata) {
        this.dataAttached = msg.attacheddata;
    }

    var self = this;
    var remoteStream;
    if (this.state === "new" || this.state === "established") {
        if (msg.messageType === "OFFER") {
            this.offer_as_string = msg.sdp;
            msg.type = "offer";
            // Ideally, b=AS field should be included in the SDP by the peer.
            // However, we need to do this here, given the gateway doesn't support it.
            msg.sdp = setVideoBandwidthInSDP(msg.sdp, this.grtcClient.bandwidthVideo);
            this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(msg), 
                function () {
                    gLogger.log("setRemoteDescription() success");
                    self.markActionNeeded();
                }, 
                function (rtcErr) {
                    gLogger.log(Grtc.GRTC_ERROR +
                        ": setRemoteDescription() failed - " + JSON.stringify(rtcErr));
                    self.markActionNeeded();    // Still send an answer if possible
                }
            );

            // Check message sequence number and print warning if necessary
            if ($.isNumeric(msg.seq)) {
                if (msg.seq <= this.sequenceNumber) {
                    gLogger.log(Grtc.GRTC_WARN + ": OFFER message out of sequence");
                }
                this.sequenceNumber = msg.seq;
            } else {
                gLogger.log(Grtc.GRTC_WARN + ": OFFER message contains no valid sequence number");
            }
            this.offer_candidates = msg.Candidates;
            this.state = "offer-received";
        
        } else if (msg.messageType === "OK" && this.state === "established") {
            try {
                remoteStream = this.peerConnection.getRemoteStreams()[0];

                // Notify the client to update the remote stream URL
                gLogger.log("OK msg received: update remote stream");
                this.onRemoteStream.fire({
                    stream: remoteStream
                });

            } catch (e) {
                // Shall not come here; skip otherwise
                gLogger.log(Grtc.GRTC_WARN +
                    ": could not retrieve remote stream, " +
                    "in state " + this.state +
                    ", with message type " + msg.messageType, e);
            }
        } else {
            gLogger.log(Grtc.CONNECTION_ERROR +
                ": incorrect message type during processSignalingMessage, " +
                "in state " + this.state +
                ", with message type " + msg.messageType);
            throw new Grtc.Error(Grtc.CONNECTION_ERROR, "Illegal message " +
                msg.messageType + " in state " + this.state);
        }
    } else if (this.state === "offer-sent") {
        if (msg.messageType === "ANSWER") {
            window.clearTimeout(this.checkNoanswer);
            msg.type = "answer";
            msg.sdp = setVideoBandwidthInSDP(msg.sdp, this.grtcClient.bandwidthVideo);
            this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(msg), 
                function () {
                    gLogger.log("setRemoteDescription() success on answer");
                    // onaddstream() will be called on first remote stream only.
                    // After that, we need to notify the client on remote stream,
                    // so that it could attach the new stream to display URL.
                    //if (self.remoteStreamAdded === true)
                    // Do this always, as there should be no real harm; and Firefox v30,
                    // in the asymmetric call case where caller has both audio and video,
                    // does not fire onaddstream, so this is needed.
                    {
                        // Current Chrome (v33/35) doesn't play audio/video with this.
                        // Without this, it'd play the audio if SDES is used, but not DTLS.
                        try {
                            remoteStream = self.peerConnection.getRemoteStreams()[0];
                            self.onRemoteStream.fire({ stream: remoteStream });
                        } catch (e) {
                            gLogger.log(Grtc.GRTC_ERROR +
                                ": could not update remote stream with answer!", e);
                        }
                    }
                }, 
                function (rtcErr) {
                    gLogger.log(Grtc.GRTC_ERROR +
                        ": setRemoteDescription() failed - " + JSON.stringify(rtcErr));
                }
            );
            // Note, this needs to be done after setRemoteDescription() call.
            this.applyCandidates(msg.Candidates);
            this.sendMessage("OK");
            this.state = "established";
        } else if (msg.messageType === "OFFER") {
            // Glare processing not written yet; do nothing
            gLogger.log("processSignalingMessage(): Glare condition. Offer sent, expecting Answer");
            return;
        } else {
            gLogger.log(Grtc.CONNECTION_ERROR +
                ": incorrect message type during processSignalingMessage, " +
                "in state " + this.state +
                ", with message type " + msg.messageType);
            throw new Grtc.Error(Grtc.CONNECTION_ERROR, "Illegal message " +
                msg.messageType + " in state " + this.state);
        }
    }
};

/* Apply ICE candidates from remote peer to peerConnection. */
gMediaSession.prototype.applyCandidates = function (Candidates) {
    var count = Candidates.length;
    var i;
    for (i = 0; i < count; i++) {
        var candidate   = Candidates[i].candidate;
        var label       = Candidates[i].sdpMLineIndex;
        var mid         = Candidates[i].sdpMid;
        var iceCandDict = {sdpMLineIndex:label, sdpMid:mid, candidate:candidate};
        var iceCandidate = new RTCIceCandidate(iceCandDict);
        try {
            gLogger.log("addIceCandidate[" +i + "]: " + JSON.stringify(iceCandidate));
            this.peerConnection.addIceCandidate(iceCandidate);
        } catch (e) {
            // do nothing other than logging
            gLogger.log(Grtc.GRTC_WARN + ": could not add ICE candidate: " +
                JSON.stringify(iceCandidate), e);
        }
    }
};

/* Mark that something happened = do something later (not on this stack). */
gMediaSession.prototype.markActionNeeded = function () {
    this.actionNeeded = true;
    var self = this;
    window.setTimeout( function () { self.onstablestate(); }, 1);
};

/* Check if offer has been sent but answer is still pending after the noanswer timeout */
gMediaSession.prototype.markPeerNoanswer = function () {
    if (this.state === "offer-sent") {
        // Notify the client as no answer received from peer after offer is sent
        gLogger.log(Grtc.GRTC_WARN + ": answer not received from peer within " + 
                                        this.grtcClient.noansTimeout + " ms");
        this.grtcClient.onPeerNoanswer.fire();
    }
};


/* Called when a stable state is entered by the browser
 * (to allow for multiple AddStream calls or other interesting actions).
 *
 * This function will generate an offer or answer, as needed, and send
 * to the remote party. */
gMediaSession.prototype.onstablestate = function () {
    gLogger.log("onstablestate(state=" + this.state + ")");
    if (this.actionNeeded) {
        this.actionNeeded = false;
        try {
            if (this.state === "make-offer") {
                this.prepareForIceGathering();   // Should be called before makeOffer()
                this.makeOffer();
                this.state = "preparing-offer";
            } else if (this.state === "preparing-offer") {
                // If we have the ICE candidates and SDP, send the offer,
                // and set a no-answer timeout.
                if (!this.moreIceComing && this.outSDP !== null) {
                    this.sendMessage("OFFER", true);
                    this.state = "offer-sent";
                    var self = this;
                    this.checkNoanswer = window.setTimeout(
                        function () { self.markPeerNoanswer(); },
                        self.grtcClient.noansTimeout );
                }
            } else if (this.state === "offer-sent") {
                // This may happen with Firefox (without renegotiation support).
                gLogger.log("waiting answer");
            } else if (this.state === "offer-received") {
                this.prepareForIceGathering();   // Should be called before makeAnswer()
                this.makeAnswer();
                this.state = "offer-received-preparing-answer";
            } else if (this.state === "offer-received-preparing-answer") {
                // If we have the ICE candidates and SDP, send the answer.
                if (!this.moreIceComing && this.outSDP !== null) {
                    if (this.offer_candidates) {
                        this.applyCandidates(this.offer_candidates);
                        this.offer_candidates = null;
                    }
                    this.sendMessage("ANSWER", true);
                    this.state = "established";
                }
            } else {
                gLogger.log(Grtc.INVALID_STATE_ERROR +
                    ": Unexpected state " + this.state);
                throw new Grtc.Error(Grtc.INVALID_STATE_ERROR, 
                    "Unexpected state " + this.state);
            }
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": onstablestate failed", e);
            throw new Grtc.Error(Grtc.GRTC_ERROR, "exception during onstablestate");
        }
    }
};

/* Create an offer SDP with given hints. */
gMediaSession.prototype.makeOffer = function () {
    var hints = {"mandatory": {
        "OfferToReceiveAudio": this.offerToReceiveAudioInOffer,
        "OfferToReceiveVideo": this.offerToReceiveVideoInOffer
    }};
    var self = this;
    gLogger.log("Create offer with constraints: " + JSON.stringify(hints));
    
    this.outSDP = null;
    this.peerConnection.createOffer(
        function (SDP) {
            // Chrome doesn't throttle output bitrate if we set b=AS field in local SDP,
            // but it does if we set in peer SDP passed into setRemoteDescription.
            // However this should be done here, as it needs to be in the outgoing SDP.
            // Note, b=AS may not be supported by Firefox.
            SDP.sdp = setVideoBandwidthInSDP(SDP.sdp, self.grtcClient.bandwidthVideo);
            // Check if there is a hold request -- if so, set a=inactive.
            if (self.onHold) {
                SDP.sdp = SDP.sdp.replace(/a=(sendrecv|sendonly|recvonly)/gmi,
                                          "a=inactive");
            }
            // If there is no audio m-line, always add an inactive one,
            // in order to support upgrading to A+V later.
            // (Note, this couldn't be done in an answer case.)
            // This, however, doesn't help, because, when a new SDP is created
            // later with A+V, audio m-line gets ice-ufrag/pwd with empty values!
            /*if (SDP.sdp.search("m=audio") < 0) {
                SDP.sdp = SDP.sdp.replace(/m=video/i,
                          "m=audio 0 RTP/SAVPF 0\r\na=inactive\r\nm=video");
            } */
            self.outSDP = SDP;
            gLogger.log("createOffer success");
            self.peerConnection.setLocalDescription(
                SDP,
                function () {
                    var iceState = self.peerConnection.iceGatheringState;
                    gLogger.log("setLocalDescription() success - iceGatheringState: " +
                                 iceState);
                    if (iceState === "complete" && self.grtcClient.candidatesExpected === false) {
                        gLogger.log("ICE gathering complete");
                        self.iceStarted = false;
                        self.moreIceComing = false;
                        self.markActionNeeded();
                    } else {
                        self.grtcClient.candidatesExpected = false;
                    }
                },
                function (rtcErr) {
                    gLogger.log(Grtc.WEBRTC_ERROR +
                        ": setLocalDescription of offer failed - " + JSON.stringify(rtcErr));
                    gLogger.log("This is the offer SDP that caused failure:\n" +
                        JSON.stringify(self.outSDP));
                    //throw new Grtc.Error(Grtc.WEBRTC_ERROR,
                    //    "exception during setLocalDescription");
                }
            );
            /* Candidates in SDP does not always mean, gathering is done.
               For e.g., when video is added in Chrome, audio candidates are
               in SDP, but video candidates notified later via onicecandidate.
            if (SDP.sdp.search('a=candidate') !== -1) {
                // ICE gathering done (typical to current Firefox - no trickle ICE)
                gLogger.log("ICE candidates found in offer SDP created");
                //self.iceStarted = false;
                self.moreIceComing = false;
            }
            if (!self.moreIceComing)
                self.markActionNeeded();  */
        },
        function (rtcErr) {
            gLogger.log(Grtc.WEBRTC_ERROR + ": createOffer failed - " +
                JSON.stringify(rtcErr));
            //throw new Grtc.Error(Grtc.WEBRTC_ERROR, "exception during createOffer");
        },
        hints
    );
};

/* Make an answer SDP with given hints. */
gMediaSession.prototype.makeAnswer = function () {
    var hints = {"mandatory": {
        "OfferToReceiveAudio": this.offerToReceiveAudioInAnswer,
        "OfferToReceiveVideo": this.offerToReceiveVideoInAnswer
    }};
    var self = this;
    gLogger.log("Create answer with constraints: " + JSON.stringify(hints));
    this.outSDP = null;
    this.peerConnection.createAnswer(
        function (SDP) {
            // If video is not sent or received, set the video port to 0.
            // This is necessary for Chrome, as it wrongly sets the direction to sendonly.
            // This is necessary for Firefox, as, though the direction gets set
            // correctly to "inactive", the caller waits for video, otherwise.
            if (self.grtcClient.videoConstraints === false && 
                SDP.sdp.match(/m=video \d+ RTP[\s\S]*a=(sendonly|inactive)/mi) !== null) {
                SDP.sdp = SDP.sdp.replace(/m=video \d+/i, "m=video 0");
            }
            SDP.sdp = setVideoBandwidthInSDP(SDP.sdp, self.grtcClient.bandwidthVideo);
            self.outSDP = SDP;
            gLogger.log("createAnswer success");
            self.peerConnection.setLocalDescription(
                SDP,
                function () {
                    var iceState = self.peerConnection.iceGatheringState;
                    gLogger.log("setLocalDescription() success - iceGatheringState: " +
                                iceState);
                    if (iceState === "complete" && self.grtcClient.candidatesExpected === false) {
                        gLogger.log("ICE gathering complete");
                        self.iceStarted = false;
                        self.moreIceComing = false;
                        self.markActionNeeded();
                    } else {
                        self.grtcClient.candidatesExpected = false;
                    }
                },
                function (rtcErr) {
                    gLogger.log(Grtc.WEBRTC_ERROR +
                        ": setLocalDescription of answer failed - " + JSON.stringify(rtcErr));
                    gLogger.log("This is the answer SDP that caused failure:\n" +
                        JSON.stringify(self.outSDP));
                    //throw new Grtc.Error(Grtc.WEBRTC_ERROR,
                    //    "exception during setLocalDescription");
                }
            );
            /* if (SDP.sdp.search('a=candidate') !== -1) {
                // ICE gathering done (typical to current Firefox - no trickle ICE)
                gLogger.log("ICE candidates found in answer SDP created");
                //self.iceStarted = false;
                self.moreIceComing = false;
            }
            if (!self.moreIceComing)
                self.markActionNeeded();  */
        },
        function (rtcErr) {
            gLogger.log(Grtc.WEBRTC_ERROR + ": createAnswer failed - " +
                JSON.stringify(rtcErr));
            //throw new Grtc.Error(Grtc.WEBRTC_ERROR, "exception during createAnswer");
        },
        hints   // This seems to have no effect on Chrome, and is replaced in the new API.
    );
};

/* Send a signalling message.
 * @param {string} operation - operation name, OFFER, ANSWER, or OK.
 * @param {string} sdp       - SDP message body. */
gMediaSession.prototype.sendMessage = function (operation, withSDP) {
    var roapMessage = {};
    roapMessage.messageType = operation;
    if (withSDP) {
        roapMessage.sdp = this.outSDP.sdp;
        var msgCandidates = [];
        // Get the candidates from the SDP itself first.  FYI, with Chrome,
        // if media is upgraded from audio to a+v, then audio candidates
        // are found in SDP, and video ones will be notified using onicecandidate.
        if (roapMessage.sdp.search("a=candidate") >= 0) {
            msgCandidates = extractIceCandidatesFromSdp(roapMessage.sdp);
        }
        // Add any candidates collected from onicecandidate events.
        if (this.localCandidates.length > 0) {
            msgCandidates = msgCandidates.concat(this.localCandidates);
            this.localCandidates = [];
        }
        try {
            roapMessage.Candidates = this.grtcClient.filterIceCandidates(msgCandidates);
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": filterIceCandidates() failed", e);
            roapMessage.Candidates = msgCandidates;
        }
    }
    if (operation === "OFFER") {
        roapMessage.offererSessionId = this.sessionId;
        roapMessage.answererSessionId = this.otherSessionId;  // May be null
        roapMessage.seq = ++this.sequenceNumber;
        // The tiebreaker needs to be neither 0 nor 429496725
        roapMessage.tiebreaker = Math.floor(Math.random() * 429496723 + 1);
    } else {
        roapMessage.offererSessionId = this.incomingMessage.offererSessionId;
        roapMessage.answererSessionId = this.sessionId;
        roapMessage.seq = this.incomingMessage.seq;
    }
    
    // Attach data if available
    if (this.dataToAttach) {
        roapMessage.attacheddata = this.dataToAttach;
    }
    sendToPeer(this.grtcClient, this.pcDest, "RSMP " + JSON.stringify(roapMessage));
};

// ============================================================================
// Public interface of MediaSession contains the following:
//   makeCall
//   acceptCall
//   rejeceCall
//   updateCall
//   terminateCall
//   closeSession
//   holdCall
//   resumeCall
//   setData
//   getData
// ============================================================================


/* Initiate an audio/video call, or send a new offer.  The latter could be
 * due to a user request for an upgrade, or due to an INVITE message.
 * In the new offer case, remoteId could be set to 0.
 * Perhaps, this should be renamed as makeOffer.
 */
gMediaSession.prototype.makeCall = function (remoteId,
                                             audioConstraints, videoConstraints,
                                             holdMedia) {
    if (this.state !== "new" && this.state !== "established") {
        gLogger.log(Grtc.INVALID_STATE_ERROR +
                    ": Can't make an offer in state " + this.state);
        return;
    }
    this.state = "make-offer";
    // At this point, user should have authorized local media access,
    // which determines what to send (audio/video). Before making a
    // call, the user can still control what to receive (audio/video),
    // and the constraints will be used in createOffer.
    if (typeof audioConstraints !== "undefined") {
        this.offerToReceiveAudioInOffer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.offerToReceiveVideoInOffer = videoConstraints;
    }
    // If remoteId is 0 (call is established), use current pcDest.
    if (remoteId !== 0) {
        this.pcDest  = remoteId;
    }
    if (typeof holdMedia === "boolean") {
        this.onHold = holdMedia;
    }
    gLogger.log("Send SDP offer to " + this.pcDest);
    this.callState = CALL_STATE_ONGOING;
    this.markActionNeeded();
};

/* Accept a call, or answer a new offer, using ID passed in or saved in client.
 * Note that the audio/videoConstraints seems to have no effect on Chrome,
 * and have been replaced in the new createAnswer() API.
 * Perhaps, this method should be renamed as acceptOffer.
 */
gMediaSession.prototype.acceptCall = function (audioConstraints, videoConstraints,
                                               remoteId) {
    if (this.state !== "new" && this.state !== "established") {
        gLogger.log(Grtc.INVALID_STATE_ERROR +
                    ": Can't accept an offer in state " + this.state);
        return;
    }
    // At this point, user should have authorized local media access,
    // which determines what to send (audio/video). Before accepting a
    // call, the user can still control what to receive (audio/video),
    // and the constraints will be used in createAnswer.
    if (typeof audioConstraints !== "undefined") {
        this.offerToReceiveAudioInAnswer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.offerToReceiveVideoInAnswer = videoConstraints;
    }
    
    var hints = {"mandatory": {
        "OfferToReceiveAudio": this.offerToReceiveAudioInAnswer,
        "OfferToReceiveVideo": this.offerToReceiveVideoInAnswer
    }};
    gLogger.log("Answer offer with constraints: " + JSON.stringify(hints));
    
    if (this.grtcClient.incomingMsg !== null) {
        if (typeof remoteId !== "undefined" && remoteId !== 0) {
            this.pcDest = remoteId;
        } else if (this.grtcClient.pcCaller) {
            this.pcDest = this.grtcClient.pcCaller;
        }
        this.grtcClient.pcCaller = null;
        try {
            this.processSignalingMessage(this.grtcClient.incomingMsg);
            this.grtcClient.incomingMsg = null;
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR + ": acceptCall failed", e);
            throw new Grtc.Error(Grtc.GRTC_ERROR,
                "exception during processSignalingMessage");
        }
        this.callState = CALL_STATE_ONGOING;
    }
};

/* Reject an incoming call by sending a BYE to an ID passed in or
 * saved in client.
 */
gMediaSession.prototype.rejectCall = function (remoteId) {
    if (typeof remoteId !== "undefined" && remoteId !== 0) {
        this.pcDest = remoteId;
    } else if (this.grtcClient.pcCaller) {
        this.pcDest = this.grtcClient.pcCaller;
    }
    this.grtcClient.pcCaller = null;
    this.grtcClient.incomingMsg = null;
    gLogger.log("Rejecting call from " + this.pcDest);
    if (this.pcDest) {
        sendToPeer(this.grtcClient, this.pcDest, "BYE");       
    }
    this.closeSession();
};

/* Update the call in progress by resetting local media streams. For now, we only
 * support "true" and "false" constraints; and other valus of audioConstraints
 * and videoConstraints will be ignored.
 */
gMediaSession.prototype.updateCall = function (audioConstraints, videoConstraints) {
    if (this.state !== "established") {
        gLogger.log(Grtc.INVALID_STATE_ERROR + ": Can't update call: call is not in established state");
        return;
    }
    if (this.grtcClient.localStream === null) {
        gLogger.log(Grtc.INVALID_STATE_ERROR + ": Can't update call: there is no local media stream to update");
        return;
    }
    gLogger.log("old constraints: " + this.grtcClient.audioConstraints + ", " +
            this.grtcClient.videoConstraints);
    gLogger.log("new constraints: " + audioConstraints + ", " + videoConstraints);
    
    var i;
    // audio tracks update
    if (typeof audioConstraints !== "undefined" && audioConstraints !== this.grtcClient.audioConstraints) {
        var audioTrackList = this.grtcClient.localStream.getAudioTracks();
        if (audioTrackList) {
            for (i = 0; i < audioTrackList.length; ++i) {
                audioTrackList[i].enabled = !(audioTrackList[i].enabled);
                gLogger.log("Audio track [" + i + "]: " + (audioTrackList[i].enabled ? "muted":"unmuted"));
            }
        }
        this.grtcClient.audioConstraints = audioConstraints;
    }
    // video tracks update
    if (typeof videoConstraints !== "undefined" && videoConstraints !== this.grtcClient.videoConstraints) {
        var videoTrackList = this.grtcClient.localStream.getVideoTracks();
        if (videoTrackList) {
            for (i = 0; i < videoTrackList.length; ++i) {
                videoTrackList[i].enabled = !(videoTrackList[i].enabled);
                gLogger.log("Video track [" + i + "]: " + (videoTrackList[i].enabled ? "enabled":"disabled"));
            }
        }
        this.grtcClient.videoConstraints = videoConstraints;
    }
};

/* Terminate a call.
   Obsoleted - use closeSession() instead.
 */
gMediaSession.prototype.terminateCall = function () {
    this.closeSession(true);
};

/* Close down the media session, and send BYE if requested. */
gMediaSession.prototype.closeSession = function (sendBye) {
    gLogger.log("Closing down the media session");
    if (typeof sendBye === "boolean" && sendBye === true) {
        sendToPeer(this.grtcClient, this.pcDest, "BYE");
    }
    this.callState = CALL_STATE_NOT_STARTED;
    this.state = "closed";
    this.pcDest = null;
    removeLocalStreams(this);
    if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
    }
    this.grtcClient.mediaSession = null;
};

/* Hold an audio/video call. */
gMediaSession.prototype.holdCall = function () {
    if (this.state !== "established") {
        gLogger.log(Grtc.INVALID_STATE_ERROR + ": Can't hold call: call is not in established state");
        return;
    }
    this.onHold = true;
    this.state = "make-offer";
    this.markActionNeeded();
};

/* Resume an audio/video call. */
gMediaSession.prototype.resumeCall = function () {
    if (this.state !== "established") {
        gLogger.log(Grtc.INVALID_STATE_ERROR + ": Can't resume call: call is not in established state");
        return;
    }
    this.onHold = false;
    this.state = "make-offer";
    this.markActionNeeded();
};

/* Set a data item to be attached to the OFFER message.
 * data: a JSON array passed in, where each element in the array
 *       is an object that contains two properties: key and value.
 *       Example:
         [
            {
                "key": "Name",
                "value": "Yong"
            },
            {
                "key": "Account",
                "value": "123456789"
            }
         ]
 */
gMediaSession.prototype.setData = function (data) {
    if (data) {
        try {
            // check if the user data is a non-empty array
            if ($.isArray(data) && data.length>0) {
                // check if each element in the array is well formed
                var isWellFormed = true;
                var i;
                for (i=0; i<data.length; ++i) {
                    var dataElement = data[i];
                    // each element should be an object
                    // and should contain exactly two properties
                    if (typeof dataElement !== "object" ||
                        Object.keys(dataElement).length !== 2 ||
                        !dataElement.hasOwnProperty("key") ||
                        !dataElement.hasOwnProperty("value")) {
                        isWellFormed = false;
                        break;
                    }
                }
                if (isWellFormed) {
                    this.dataToAttach = data;
                    return;
                }
            }
        } catch (e) {
            // Throw at the end
            gLogger.log(Grtc.GRTC_ERROR + ": data attached is not well-formed", e);
        }
    }
    throw new Grtc.Error(Grtc.GRTC_ERROR, "Data attached is not well-formed");
};

/* Get the data item received from the OFFER message. */
gMediaSession.prototype.getData = function () {
    return this.dataAttached;
};

/* Send mid-call ROAP INFO message to the WebRTC Gateway with the input data.
 * The gateway, in turn, sends a SIP INFO message to the SIP-Server with the data 
 * in the body of the message. The input data should be an object. A serialized 
 * representation of the data is created (URL query string format) before sending 
 * to the Gateway.
 * When mapData is set to true (or undefined), the content-type of the SIP INFO message 
 * (from Gateway to SIP-Server) is set to application/x-www-form-urlencoded. In this case, 
 * the SIP Server consumes the data and map it to the corresponding T-Library events.
 * Otherwise the content-type for the SIP INFO message is set to application/octet-stream 
 * and the SIP-Server simply passes the message to the remote end.
 */
gMediaSession.prototype.sendInfo = function (data, mapData) {
    if (this.state !== "established") {
        gLogger.log(Grtc.GRTC_ERROR + "INFO message not sent: call is not established yet");
        return;
    }
    if (!$.isEmptyObject(data)) {
        gLogger.log("INFO message input Data: " + JSON.stringify(data));
        // jQuery param() is used to convert form element values 
        // into a serialized string representation
        var info = $.param(data);
        //
        if (typeof mapData !== "boolean") {
            mapData = true;
        }
        if (mapData === true) {
            sendToPeer(this.grtcClient, this.pcDest, "INFO-MAP " + info);
        } else {
            sendToPeer(this.grtcClient, this.pcDest, "INFO-PEER " + info);
        }
    } else {
        gLogger.log(Grtc.GRTC_ERROR + ": INFO message not sent: input data should be a non-empty object");
    }
};

// Export Grtc.MediaSession
Grtc.MediaSession = gMediaSession;

}) ();

// Static variable for allocating new session IDs
Grtc.MediaSession.sessionId = 101;

/* Handle a message received from peer. */
function handlePeerMessage(objClient, peer_name, msg) {
    // Note: the BYE message is sent by itself instead of in a JSON
    // object (which is the case for other messages); we might consider
    // making it consistent in the future
    if (msg.search("BYE") === 0) {
        // Other side has hung up
        gLogger.log("BYE received from peer");
        if (objClient.mediaSession) {
            objClient.mediaSession.closeSession();
        }
        // Notify the client that the peer is closing
        objClient.onPeerClosing.fire();
    } else if (msg.search("INVITE") === 0) {
        gLogger.log("INVITE message received from " + peer_name);
        /* if (objClient.mediaSession) {
            var curState = objClient.mediaSession.state;
            if (curState === "established") {
                objClient.mediaSession.state = "make-offer";
                objClient.mediaSession.markActionNeeded();
            }
            else {
                gLogger.log(Grtc.INVALID_STATE_ERROR +
                    ": INVITE message received in unexpected state " + curState);
                throw new Grtc.Error(Grtc.INVALID_STATE_ERROR,
                    "INVITE message received in state " + curState);
            }
        }
        else */
        // Always fire onInvite, and let the app decide if it wants to reuse
        // existing media session, if any, or create a new one.
        if (peer_name) {
            // Notify the client to create the media session and make a call.
            // Note, pcDest in mediaSession will be set on makeCall.
            objClient.onInvite.fire({
                peer: peer_name
            });
        }
    } else if (msg.search("INFO-PEER ") === 0) {
        // Notify the client with the data received with the message.
        // The data may be serailized - so conversion needed
        try {
            gLogger.log("INFO-PEER message received with data: " + msg.substr(10));
            var data = Grtc.deparam(msg.substr(10));
            objClient.onInfoFromPeer.fire(data);
        } catch (e) {
            gLogger.log(Grtc.GRTC_ERROR +
                ": handlePeerMessage failed for INFO-PEER", e);
            throw new Grtc.Error(Grtc.GRTC_ERROR,
                "exception during handlePeerMessage INFO-PEER");
        }
    } else if (msg.search("ERROR") > 0 && msg.search("errorType") > 0 && msg.search("{") > 0) {
        // Print error message received from the gateway.
        // Also, fire onGatewayError event to let the application decide.
        // Currently, we don't send error specific text from the gateway, only
        // the error type is populated.
        var json, jsonObj, errType;
        try {
            json    = msg.substr(msg.search("{"));
            jsonObj = JSON.parse(json);
            errType = jsonObj.errorType;
            gLogger.log(Grtc.GRTC_ERROR + ": message received from the Gateway: " + errType);
            objClient.onGatewayError.fire({
                error: errType
            });
        } catch (e) {
            gLogger.log(Grtc.GRTC_WARN + ": exception for parsing error message: " + msg, e);
        }
    } else {
        // For offer, always fire onIncomingCall, and let the app decide if it
        // wants to reuse the existing media session, if any, or create one.
        var offsetOffer = msg.search("OFFER");
        if (objClient.mediaSession && offsetOffer < 0) {
            try {
                objClient.mediaSession.processSignalingMessage(msg);
            } catch (e) {
                gLogger.log(Grtc.GRTC_ERROR +
                    ": handlePeerMessage failed", e);
                throw new Grtc.Error(Grtc.GRTC_ERROR,
                    "exception during handlePeerMessage");
            }
        } else if (msg.search("SDP") === 0 && offsetOffer > 0 && peer_name) {
            // An offer message - save the info in client, and fire the event.
            gLogger.log("OFFER received from peer " + peer_name);
            // Ideally, this should be passed back into acceptCall/rejectCall.
            objClient.pcCaller = peer_name;

            // Notify client of incoming call, and the client is expected
            // to handle the event by calling acceptCall or rejectCall
            objClient.incomingMsg = msg;
            objClient.onIncomingCall.fire({
                peer: peer_name
            });
        }
        else {
            gLogger.log(Grtc.GRTC_WARN + ": unexpected message received:\n" + msg);
        }
    }
}

/* Start to poll WebRTC gateway. */
function startHangingGet(objClient, isTimer) {
    try {
        var queryurl = objClient.configuration.webrtc_gateway + 
                        "/wait?id=" + objClient.registeredSSID;
        $.get(queryurl, function (data, textStatus, jqXHR) {
            // You can access readyState/status/data via jqXHR
            try {
                if (jqXHR.readyState !== 4 || objClient.disconnecting) {
                    return;
                }
                    
                if (jqXHR.status !== 200) {
                    doSignOut(objClient);
                    objClient.onPeerClosing.fire();
                } else {
                    var peer_name = jqXHR.getResponseHeader("Pragma");
                    handlePeerMessage(objClient, peer_name, jqXHR.responseText);
                }

                if (objClient.registeredSSID !== -1) {
                    window.setTimeout(function() { startHangingGet(objClient, true); }, 0);
                }
            } catch (e) {
                if (typeof isTimer === "boolean" && isTimer === true) {
                    gLogger.log(Grtc.GRTC_ERROR + ": startHangingGet", e);
                } else {
                    throw e;
                }
            }
        })
        .fail(function (jqXHR, textStatus) {
            if (textStatus === "timeout") {
                gLogger.log("Hanging get times out");
                jqXHR.abort();
                if (objClient.registeredSSID !== -1) {
                    window.setTimeout(function() { startHangingGet(objClient, true); }, 0);
                }
            }
        });
    } catch (e) {
        gLogger.log(Grtc.GRTC_ERROR + ": startHangingGet failed", e);
        if (typeof isTimer === "undefined" || isTimer === false) {
            throw new Grtc.Error(Grtc.GRTC_ERROR, "exception during startHangingGet");
        }
    }
}

/* Send message to peer. */
function sendToPeer(objClient, peer_id, data) {
    if (objClient.registeredSSID !== -1) {
        gLogger.log("sendToPeer(" + peer_id + ", Data: " + data + ")");
        var gateway = objClient.configuration.webrtc_gateway;
        var queryurl = gateway + "/message?from=" + objClient.registeredSSID +
                        "&to=" + peer_id;
        var jqhxr = $.post(queryurl, data);
        return jqhxr;
    }
    return null;
}

/* Sign out from WebRTC gateway. */
function doSignOut(objClient) {
    // Cleanup all active connections (if applicable) and then sign out.
    var gateway = objClient.configuration.webrtc_gateway;

    if (objClient.mediaSession !== null) {
        if (objClient.mediaSession.callState === CALL_STATE_ONGOING) {
            var pcDest = objClient.mediaSession.pcDest;
            gLogger.log("Sign out: hanging up call by sending BYE to peer: " + pcDest);
            sendToPeer(objClient, pcDest, "BYE");
        }
        objClient.mediaSession.closeSession();
    }

    objClient.disconnecting = true;
    if (objClient.registeredSSID !== -1) {
        var queryurl = gateway + "/sign_out?id=" + objClient.registeredSSID;
        // Currently no specific handling if a sign_out request fails -
        // the client will just quit.
        $.get(queryurl);
        objClient.registeredSSID = -1;
    }
    objClient.disconnecting = false;
}

/* Extract ICE candidates from an SDP string, and return an array of candidates
   that are in RTCIceCandidate format. Note, currently in the case of FireFox,
   the ICE candidates are always in the SDP.  With Chrome, candidates are found
   in the SDP on renegotiation cases only.
 */
function extractIceCandidatesFromSdp(sdp) {
    var sdpLines = sdp.split('\r\n');
    var sdpMLineIndex = -1;
    var sdpMid = "";
    var candidates = [ ];
    var i;
    for (i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
            sdpMLineIndex += 1;
            sdpMid = "audio";
        } else if (sdpLines[i].search('m=video') !== -1) {
            sdpMLineIndex += 1;
            sdpMid = "video";
        } else if (sdpLines[i].search('a=candidate') !== -1) {
            var candidate = {};
            candidate.sdpMLineIndex = sdpMLineIndex;
            candidate.sdpMid = sdpMid;
            candidate.candidate = sdpLines[i]; //+ '\r\n';
            candidates.push(candidate);
        }
    }
    return candidates;
}

// Export Grtc
window.Grtc = Grtc;

})(window, navigator, document, jQuery);
