var program = require('commander');
var Tappy = require("@taptrack/tappy");
var SerialCommunicator = 
        require("@taptrack/tappy-nodeserialcommunicator");
var BasicNfcFamily = 
        require("@taptrack/tappy-basicnfcfamily");

var exit = function(tappy,code) {
    if(tappy.isConnected()) {
        tappy.disconnect(function() {
            process.exit(code);
        });
    } else {
        process.exit(code);
    }
};

var getErrorListener = function(tappy) {
    return function (errorType,data) {
        switch(errorType) {
        case Tappy.ErrorType.NOT_CONNECTED:
            console.error("Tappy not connected");
            exit(tappy,1);
            break;
        case Tappy.ErrorType.CONNECTION_ERROR:
            console.error("Connection error");
            exit(tappy,1);
            break;
        case Tappy.ErrorType.INVALID_HDLC:
            console.error("Received invalid frame");
            break;
        case Tappy.ErrorType.INVALID_TCMP:
            console.error("Received invalid packet");
            break;
        default:
            console.error("Unknown error occurred");
            exit(tappy,1);
            break;
        }
    };
};

var getMessageListener = function(tappy) {
    return function(msg) {
        var resolver = new BasicNfcFamily.Resolver();
        var resp = BasicNfcFamily.Responses;
        var resolved = null;
        
        if(resolver.checkFamily(msg)) {
            resolved = resolver.resolveResponse(msg);
        }

        if(resolved === null) {
            console.error("Unexpected response");
            exit(tappy,1);
        }

        if(resp.TagFound.isTypeOf(resolved)) {
            var tagTypeId = resolved.getTagType(); 
            var tagProps = 
                Tappy.resolveTagType(tagTypeId);
            var tagCodeBuf = 
                new Buffer(resolved.getTagCode());
            var tagCodeStr = tagCodeBuf
                .toString("hex").toUpperCase();

            if(tagProps !== null) {
                console.log(
                    "UID: %s, Tag Description: %s",
                    tagCodeStr,
                    tagProps.description);
            } else {
                console.log("UID: %s",
                        tagCodeStr);
            }
        } else if (resp.ScanTimeout.isTypeOf(resolved)) {
            console.log("Timeout reached");
            exit(tappy,0);
        } else {
            console.error("Unexpected response");
            exit(tappy,1);
        }
    };
};

var streamTags = function(path,timeout) {
    var comm = new SerialCommunicator({path: path});
    
    var tappy = new Tappy({communicator: comm});
    var msg = new BasicNfcFamily.Commands.StreamTags(
        timeout,BasicNfcFamily.PollingModes.GENERAL);
    
    tappy.setErrorListener(getErrorListener(tappy));
    tappy.setMessageListener(getMessageListener(tappy));
    
    tappy.connect(function() {
        console.log("Tappy connected!");
        tappy.sendMessage(msg);
    });
};

program
    .command('stream-tags <path>')
    .alias('stream')
    .description("Stream tags")
    .option('-t, --timeout <timeout>','Time to stream for, 0 is indefinite',parseInt,0)
    .action(function(path,options) {
        streamTags(path,options.timeout);   
    });

program.parse(process.argv);
