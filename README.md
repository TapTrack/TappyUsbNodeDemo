# Using the TapTrack Tappy for easy NFC on Node
By putting high-level NFC application logic on the reader
itself, the TapTrack Tappy family of NFC Readers provides a simple way 
to add NFC to any project. Now with a Node Serial Port-compatible
SDK, you can be off and running toward a neat NFC application in
mere minutes. In this tutorial, we're going to write a basic command-line
utility that scans for tags.

## Platform Support
For TappyUSB devices, the SDK will work on any platform supported by Node SerialPort
3.1. Currently TapTrack has not tested any Bluetooth libraries to enable usage of
TappyBLE devices with Node, but any library that is API-compatible with SerialPort
should work.

## Getting Started
First, you must install the appropriate version of NodeJS for your computer.
On Linux, your distribution's package manager likely has a Node package available,
but please consult the [NodeJS website](https://nodejs.org/en/) for the details of
installing on your system.

Once Node is installed, navigate to the directory you wish to create the project in
and run `npm init`. After answering a few questions, you should now have your project
set up and ready for development.

## Finding the Tappy's serial port
In order to use the Tappy, we must first determine what serial port it is connected on:

### Determining Serial path on Linux/Mac
1. Open a terminal
2. If you have your Tappy plugged in, unplug it
3. Plug the Tappy in
4. Enter the command "dmesg | grep USB"
5. A lot of information will now be printed, but you can ignore most of it.
Look near the last couple of lines for something that looks like:
```
usb 3-3.1: FTDI USB Serial Device converter now attached to ttyUSB0
```
This tells you that the port is /dev/ttyUSB0

### Determining Serial port on Windows
1. Plug the Tappy in 
2. Open your device manager
3. You should see an entry called "Ports" containing one or more COM ports,
if only one COM port is listed, that is most likely the Tappy. However, if
multiple COM ports are present, proceed to step 4.
4. Unplug the Tappy and one of the COM ports should disappear.
5. Plug the Tappy back in and wait for a new COM port to appear in the list.
This is the Tappy's COM port.

## Connecting to the Tappy
Once we know the Tappy's serial port, we will need two libraries to actually
connect to it. Run the following commands in your project folder:
```
npm install @taptrack/tappy --save
npm install @taptrack/tappy-nodeserialcommunicator --save
```
At this point, your project's `package.json` should look something like this:
```json
{
    "name": "tappy-util",
    "version": "0.0.1",
    "description": "Command line Node utility for interacting with TappyUSB devices",
    "main": "index.js",
    "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
    },
    "keywords": [
        "TappyUSB",
        "NFC"
    ],
    "author": "TapTrack",
    "license": "Apache-2.0",
    "dependencies": {
        "@taptrack/tappy": "^1.1.0",
        "@taptrack/tappy-nodeserialcommunicator": "^1.0.0"
    }
}
```
If you haven't already, create the project's source file (index.js by default) 
and open it in your preferred text editor. We start by importing the Tappy
and NodeSerialCommunicator packages via `require()`

```javascript
var Tappy = require("@taptrack/tappy");
var SerialCommunicator = require("@taptrack/tappy-nodeserialcommunicator");
```

The Tappy library is designed to be agnostic to the transport layer that is
being used to communicate with the Tappy. In order to do this, when you 
construct a Tappy object, you must pass it a TappyCommunicator object that
it will use thereafter to communicate with the Tappy, so lets start there.


```javascript
var comm = new SerialCommunicator({path: "/dev/ttyUSB0"})
```
The path parameter should be set to whatever the serial port your found 
earlier was. This communicator creates and wraps a Node Serial Port instance
in order to provide the Tappy with a consistent API regardless of the 
communication method in use. 

Now that we have a communicator for our Tappy object to use, lets construct
it and connect.
```javascript
var comm = new SerialCommunicator({path: "/dev/ttyUSB0"})
var tappy = new Tappy({communicator: comm});
tappy.connect(function() {
    console.log("Tappy connected!");
    tappy.disconnect(function() {
        console.log("Tappy disconnected!");
        process.exit(0);
    });
});
```
Now you should be able to run this script and see the Tappy connect:
```shell
lvanoort@Osiris ~/Projects/tappyUtility $ node index.js
Tappy connected!
Tappy disconnected!
```

## Parameterizing
Hardcoding the serial port path works fine if we're writing a one-off script, but
if we want to make a useful utility, we need to be able to specify the port at runtime.
In order to make this easier, let's install an excellent Node library for writing
command line utilities.
```
npm install commander --save
```

Working with commander is out of the scope of this tutorial, so just copy the following
code to define our first command "stream-tags".
```javascript
var program = require('commander');

var Tappy = require("@taptrack/tappy");
var SerialCommunicator = require("@taptrack/tappy-nodeserialcommunicator");

program
    .command('stream-tags <path>')
    .alias('stream')
    .description("Stream tags")
    .option('-t, --timeout <timeout>','Time to stream for, 0 is indefinite',parseInt,0)
    .action(function(path, options) {
        var timeout = options.timeout;

        var comm = new SerialCommunicator({path: path})
        var tappy = new Tappy({communicator: comm});
        
        tappy.connect(function() {
            console.log("Tappy connected!");
            tappy.disconnect(function() {
                console.log("Tappy disconnected!");
                process.exit(0);
            });
        });
    });

program.parse(process.argv);
```

Now we should be able to specify the Tappy's port at runtime
```shell
lvanoort@Osiris ~/Projects/tappyUtility $ node index.js stream-tags /dev/ttyUSB0
Tappy connected!
Tappy disconnected!
```
You may notice that there is also a timeout option. This is going to be used
for the stream tags command when we implement it.

## Sending a command
Now we're ready to send a command. In order to do that we're going to bring in two
additional libraries and add them to our imports.
```shell
npm install @taptrack/tappy-basicnfcfamily --save
npm install @taptrack/tappy-systemfamily --save
```

```javascript
var SystemFamily = require("@taptrack/tappy-systemfamily");
var BasicNfcFamily = require("@taptrack/tappy-basicnfcfamily");
```
The Tappy splits up the commands and responses it supports into several different
'command families' categorized by common functionality. The System family contains
several Tappy control commands as well as system responses and error messages, while
the Basic NFC family has several commands and reponses used for basic tag detection
and writing. 

```javascript
program
    .command('stream-tags <path>')
    .alias('stream')
    .description("Stream tags")
    .option('-t, --timeout <timeout>','Time to stream for, 0 is indefinite',parseInt,0)
    .action(function(path, options) {
        var timeout = options.timeout;

        var comm = new SerialCommunicator({path: path})
        var tappy = new Tappy({communicator: comm});
        
        var msg = new BasicNfcFamily.Commands.StreamTags(
            timeout,BasicNfcFamily.PollingModes.GENERAL);
        
        tappy.connect(function() {
            console.log("Tappy connected!");
            tappy.sendMessage(msg);
        });
    });

program.parse(process.argv);
```
If you run the application now, you should see the Tappy's lights start blinking
as it starts scanning for tags. Congratulations, now you're scanning for tags!

## Listening for responses
Great, now we've connected to the Tappy and sent a command, so lets start listening
for responses. The Tappy has two listeners - an error listener and a message listener.
Let's start by setting up a basic error listener that disconnects and quits the 
application occurs.
```javascript
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
        
        var closeAndQuit = function(message) {
            console.error(message);
            tappy.disconnect(function() {
                process.exit(1);
            });
        };
        
        tappy.setErrorListener(function (errorType,data) {
            switch(errorType) {
            case Tappy.ErrorType.NOT_CONNECTED:
                console.error("Tappy not connected");
                process.exit(1);
                break;
            case Tappy.ErrorType.CONNECTION_ERROR:
                closeAndQuit("Connection error");
                break;
            case Tappy.ErrorType.INVALID_HDLC:
                console.error("Received invalid frame");
                break;
            case Tappy.ErrorType.INVALID_TCMP:
                console.error("Received invalid packet");
                break;
            default:
                closeAndQuit("Unknown error occurred");
                break;
            }
        });
        
        
        tappy.connect(function() {
            console.log("Tappy connected!");
            tappy.sendMessage(msg);
        });
    });

program.parse(process.argv);
```

Great, now we're almost done. Now we just have to listen for valid responses.
Let's start with the code:
```javascript
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
        
        var closeAndQuit = function(message) {
            console.error(message);
            tappy.disconnect(function() {
                process.exit(1);
            });
        };
        
        tappy.setErrorListener(function (errorType,data) {
            switch(errorType) {
            case Tappy.ErrorType.NOT_CONNECTED:
                console.error("Tappy not connected");
                process.exit(1);
                break;
            case Tappy.ErrorType.CONNECTION_ERROR:
                closeAndQuit("Connection error");
                break;
            case Tappy.ErrorType.INVALID_HDLC:
                console.error("Received invalid frame");
                break;
            case Tappy.ErrorType.INVALID_TCMP:
                console.error("Received invalid packet");
                break;
            default:
                closeAndQuit("Unknown error occurred");
                break;
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
                    tappy.disconnect(function() {
                        process.exit(0);
                    });
                } else {
                    closeAndQuit("Unexpected response");
                }
            } else {
                closeAndQuit("Unexpected response");
            }
        });
        
        tappy.connect(function() {
            console.log("Tappy connected!");
            tappy.sendMessage(msg);
        });
    });

program.parse(process.argv);
```
So, what is all that resolver and `isTypeOf` stuff? The messages passed by the
Tappy to the message listener are raw messages in the Tappy's messaging protocol.
In order to make sense of the payload, you have to use a resolver to convert these
raw messages into a parsed response. Similarly, the getTagType() method on the
TagFound response returns a special tag type identification code that you can 
resolve into a tag property object that contains information about the tag and
its capabilities.


## Conclusion
Now we have a command line utility that will tell the Tappy
to scan for tags and report them to the command line. All in under 100 lines of
code including error handling. If you have some NFC tags on hand, try it out, 
you should see something like this:

```shell
lvanoort@Osiris ~/Projects/tappyUtility $ node index.js stream-tags --timeout 5 /dev/ttyUSB0
Tappy connected!
UID: 04DA32CA9D3C80, Tag Description: Generic NFC Forum Type 2
UID: 04DA32CA9D3C80, Tag Description: Generic NFC Forum Type 2
UID: 04115FCAF13880, Tag Description: MIFARE DESFire - Unspecified model/capacity
UID: 04115FCAF13880, Tag Description: MIFARE DESFire - Unspecified model/capacity
UID: 04115FCAF13880, Tag Description: MIFARE DESFire - Unspecified model/capacity
UID: 04115FCAF13880, Tag Description: MIFARE DESFire - Unspecified model/capacity
UID: 04115FCAF13880, Tag Description: MIFARE DESFire - Unspecified model/capacity
Timeout reached

```


