# Using the TapTrack Tappy for easy NFC on Node
By putting high-level NFC application logic on the reader
itself, the TapTrack Tappy family of NFC Readers provides a simple way 
to add NFC to any project. Now with a Node Serial Port-compatible
SDK, you can be off and running toward a neat NFC application in
mere minutes. In this tutorial, we're going to write a basic command-line
utility that scans for tags.

## Platform Support
For TappyUSB devices, the SDK will work on any platform supported by Node SerialPort
3.1.

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
and NodeSerialCommunicator packages via `require()`:

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
var tappy = new Tappy({communicator: comm});
```
The path parameter should be set to whatever the serial port you found 
earlier was. This communicator creates and wraps a Node Serial Port instance
in order to provide the Tappy with a consistent API regardless of the 
communication method in use. 

Now that we have a Tappy object to use, lets make a function that connects to
the Tappy.
```javascript
var connectTappy = function(path) {
    var comm = new SerialCommunicator({path: path})
    var tappy = new Tappy({communicator: comm});
    tappy.connect(function() {
        console.log("Tappy connected!");
        tappy.disconnect(function() {
            console.log("Tappy disconnected!");
            process.exit(0);
        });
    });
}

connectTappy("/dev/ttyUSB0");
```
Now you should be able to run this script and see the Tappy connect:
```shell
lvanoort@Osiris ~/Projects/tappyUtility $ node index.js
Tappy connected!
Tappy disconnected!
```

## Sending a command
The Tappy splits up the commands and responses it supports into several different
'command families' grouped by common functionality. For this application we only 
need the Basic NFC command family, which includes tag detection and basic read/write
commands, so let's get it.
```shell
npm install @taptrack/tappy-basicnfcfamily --save
```

```javascript
var BasicNfcFamily = require("@taptrack/tappy-basicnfcfamily");
```

Now we're ready to tell the Tappy to stream tags. This command will cause the Tappy
to report every tag it encounters until either it is interrupted or an optional
timeout is reached. Additionally, the Tappy must be told what polling mode it should
use, usually PollingModes.GENERAL is the correct choice, but PollingModes.TYPE_1
should be chosen if you are working with Topaz tags.
```javascript
var streamTags = function(path,timeout) {
    var comm = new SerialCommunicator({path: path});
    var tappy = new Tappy({communicator: comm});

    var msg = new BasicNfcFamily.Commands.StreamTags(
        timeout,BasicNfcFamily.PollingModes.GENERAL);
    
    tappy.connect(function() {
        console.log("Tappy connected!");
        tappy.sendMessage(msg);
    });
};

streamTags("/dev/ttyUSB0",5);
```
If you run the application now, you should see the Tappy's lights blink for 
approximately five seconds as it scans for tags before it times out. 
Now let's listen to the Tappy's responses so we can see what it finds.

## Listening for responses
The format of the message listener is quite simple, only taking a single parameter -
the message that was received. However, because the driver is generic and makes no
assumptions about the command families in use, the application must parse this raw
message's payload in order to make sense of it. Conveniently, every command 
family library also provides a resolver that performs this procedure for every 
command and response in that family. Let's make use of the resolver from the Basic
NFC family to listen for TagFound and Timeout messages.
```javascript
var messageListener = function(msg) {
    var resolver = new BasicNfcFamily.Resolver();
    var resp = BasicNfcFamily.Responses;
    var resolved = null;
    
    if(resolver.checkFamily(msg)) {
        resolved = resolver.resolveResponse(msg);
    }

    if(resolved === null) {
        console.error("Unexpected response");
        return;
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
    } else {
        console.error("Unexpected response");
    }
};
```
To attach this listener to the Tappy, we merely need to add one line to our stream tags
function
```javascript
var streamTags = function(path,timeout) {
    var comm = new SerialCommunicator({path: path});
    var tappy = new Tappy({communicator: comm});
    tappy.setMessageListener(messageListener);

    var msg = new BasicNfcFamily.Commands.StreamTags(
        timeout,BasicNfcFamily.PollingModes.GENERAL);
    
    tappy.connect(function() {
        console.log("Tappy connected!");
        tappy.sendMessage(msg);
    });
};

streamTags("/dev/ttyUSB0",5);
```
Now if we run the application and hold a tag up to the reader, we should see something
like this:
```shell
lvanoort@Osiris ~/Projects/tappyUtility $ node index.js
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

## Disconnecting and Handling Errors
There are two different types of errors that your application may encounter. The
first are errors reported by the Tappy via response messages, which are handled by
the standard message listener. Although there are 
some standard errors in the System command family to cover things like the Tappy
receiving garbled or corrupted messages, most of these errors
are specific to the command you are using - for instance attempting to write
a message that exceeds a tag's capacity will cause the Tappy to send back an
error frame specific to that operation. For simplicity's sake, in this application,
we'll just treat all unexpected messages as fatal errors.

The second type of errors are errors that the driver library itself experiences such
as serial port errors or receiving garbled messages from the Tappy. These messages are
reported instead through a special purpose error listener. We will treat some of these
messages as fatal errors (NOT_CONNECTED or CONNECTION_ERROR), but others we can safely
just report and ignore (INVALID_TCMP and INVALID_HDLC) as they usually result from
transient conditions such as some random bytes being stuck in a transmission buffer.

In the case of the fatal errors, we want to close the connection and exit the program, so
the first new function we create will do just that:
```javascript
var exit = function(tappy,code) {
    if(tappy.isConnected()) {
        tappy.disconnect(function() {
            process.exit(code);
        });
    } else {
        process.exit(code);
    }
};
```
Now let's create our error listener:
```javascript
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
```
Note that we must pass this function our Tappy instance in order to create the actual
error listener callback. This is to allow the listener to disconnect the Tappy when
fatal errors occur. We will have to create a similar getMessageListener function around
our message listener to add the exit capability:
```javascript
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

```

Plugging these listeners into the Tappy driver, we get:
```javascript
var streamTags = function(path,timeout) {
    var comm = new SerialCommunicator({path: path});
    var tappy = new Tappy({communicator: comm});

    tappy.setErrorListener(getErrorListener(tappy));
    tappy.setMessageListener(getMessageListener(tappy));

    var msg = new BasicNfcFamily.Commands.StreamTags(
        timeout,BasicNfcFamily.PollingModes.GENERAL);
    
    tappy.connect(function() {
        console.log("Tappy connected!");
        tappy.sendMessage(msg);
    });
};

streamTags("/dev/ttyUSB0",5);
```
Now if we run the program, we should get the same output we got earlier, but it will
cleanly exit on a fatal error and when it receives a timeout.

## Parameterizing
Our simple utility is almost done! It can already connect to a Tappy and command it to
scan for tags, but it's a little clunky if we want to change the path or timeout. 
Let's just add a little gold plating to make it a bit more usable and
allow us to specify the timeout and serial port path at runtime. In order to do this,
lets install an excellent library for writing command-line node utilities:
```
npm install commander --save
```
and import it at the top of our program:
```javascript
var program = require('commander');
```

Working with commander is out of the scope of this tutorial, so just replace the call
to stream tags with the following:
```javascript
program
    .command('stream-tags <path>')
    .alias('stream')
    .description("Stream tags")
    .option('-t, --timeout <timeout>','Time to stream for, 0 is indefinite',parseInt,0)
    .action(function(path,options) {
        streamTags(path,options.timeout);   
    });

program.parse(process.argv);
```

Now we should be able to specify the Tappy's port and the timeout at runtime:
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

With that our little Node utility for detecting NFC tags with the TappyUSB is complete!

