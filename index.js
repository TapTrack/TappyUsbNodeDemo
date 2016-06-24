var program = require('commander');

var Tappy = require("@taptrack/tappy");
var SerialCommunicator = require("@taptrack/tappy-nodeserialcommunicator");

var SystemFamily = require("@taptrack/tappy-systemfamily");
var BasicNfcFamily = require("@taptrack/tappy-basicnfcfamily");

program
    .command('stream-tags <path>')
    .alias('stream')
    .description("Stream tags")
    .option('-t, --timeout <timeout>','Time to stream for, 0 is indefinite',parseInt,0)
    .action(function(path, options) {
        var timeout = options.timeout;

        var comm = new SerialCommunicator({path: path});
        var tappy = new Tappy({communicator: comm});
        
        var msg = new BasicNfcFamily.Commands.StreamTags(
            timeout,BasicNfcFamily.PollingModes.GENERAL);
        
        tappy.setErrorListener(function (errorType,data) {
            var isFatal = false;
            switch(errorType) {
            case Tappy.ErrorType.NOT_CONNECTED:
                console.error("Tappy not connected");
                isFatal = true;
                break;
            case Tappy.ErrorType.CONNECTION_ERROR:
                console.error("Connection error");
                isFatal = true;
                break;
            case Tappy.ErrorType.INVALID_HDLC:
                console.error("Received invalid frame");
                break;
            case Tappy.ErrorType.INVALID_TCMP:
                console.error("Received invalid packet");
                break;
            default:
                console.error("Unknown error occured");
                isFatal = true;
                break;
            }

            if(isFatal) {
                tappy.disconnect(function() {
                    process.exit(0);
                });
            }
        });

        tappy.setMessageListener(function(msg) {
            var nfcResolver = new BasicNfcFamily.Resolver();
            var systemResolver = new SystemFamily.Resolver();
            var resolved = null;
            
            if(nfcResolver.checkFamily(msg)) {
                resolved = nfcResolver.resolveResponse(msg);
            } else if (systemResolver.checkFamily(msg)) {
                resolved = systemResolver.resolveResponse(msg);
            }

            if(resolved !== null) {
                if(BasicNfcFamily.Responses.TagFound.isTypeOf(resolved)) {
                    var tagTypeId = resolved.getTagType(); 
                    var tagProps = Tappy.resolveTagType(tagTypeId);
                    var tagCode = new Buffer(resolved.getTagCode());

                    if(tagProps !== null) {
                        console.log(
                            "UID: %s, Tag Description: %s",
                            tagCode.toString("hex").toUpperCase(), 
                            tagProps.description);
                    } else {
                        console.log("UID: %s",tagCode.toString("hex").toUpperCase());
                    }
                } else if (BasicNfcFamily.Responses.ScanTimeout.isTypeOf(resolved)) {
                    console.log("Timeout reached");
                    process.exit(1);
                } else {
                    console.error("Unexpected response");
                    process.exit(1);
                }
            } else {
                console.error("Unexpected response");
                process.exit(1);
            }
        });
        
        tappy.connect(function() {
            console.log("Tappy connected!");
            tappy.sendMessage(msg);
        });
    });

program.parse(process.argv);
