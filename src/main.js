"use strict";
/******************************************************************************
 * MIT License
 * Copyright (c) 2017 https://github.com/vroomlabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Created by rogerk on 7/6/17.
 ******************************************************************************/
/* eslint-disable no-console, no-process-exit */
const path = require("path");
const child = require("child_process");

const os = require('os');
const ifaces = os.networkInterfaces();

function getLocalIpAddress() {
  let ip_address = '127.0.0.1';

  Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }

      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        console.log(ifname + ':' + alias, iface.address);
        ip_address = iface.address;
      } else {
        // this interface has only one ipv4 adress
        console.log(ifname, iface.address);
        ip_address = iface.address;
      }
      ++alias;
    });
  });

  return ip_address;
}

function Arguments(params) {

    this.endpoint = process.env.ENDPOINT_NAME || ""; //[service-name].endpoints.[google-project].cloud.goog
    this.keyfile = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    this["esp-port"] = 8000;
    this["app-port"] = 8080;
    this.protocol = "grpc";

    for (let ix=0; ix < params.length; ix++) {
        let param = params[ix];
        let m = param.match(/^--?([?\w_-]+)([:=](.*))?$/);
        if (m) {
            let name = m[1].toLowerCase();
            let val = m[3];
            this[name] = val;
        }
        else {
            if (this.command) {
                throw new Error(`Unable to process both commands: ${this.command} and ${param}`);
            }
            this.command = param.toLowerCase();
        }
    }

    if (!this.command || this.command === "help" || this.hasOwnProperty("help") || this.hasOwnProperty("?")) {
        this.command = "help";
    }
}

const args = new Arguments(process.argv.slice(2));
if (args.command === "help") {
    console.log(`
Usage: esp-runner (command) -arg=value (-arg=value )+

Commands: start, run, debug

Arguments:
    -endpoint=[service-name].endpoints.[google-project].cloud.goog 
    -keyfile=serviceaccount.json # service account json key 
    -esp-port=8000  # Port number for esp to listen on
    -app-port=8080  # Port number your application is listening on
    -protocol=grpc|http|https
    -print-primitive=true|false

Example:

    esp-runner run -endpoint=[service-name].endpoints.[google-project].cloud.goog \\
        -keyfile=serviceaccount.json -esp-port=8000 -app-port=8080 -protocol=grpc
 
`);
}

let keypath, keyfile, version;
if (args.command === "start" || args.command === "run" || args.command === "debug") {
    let missing = Object.keys(args).filter(name => !args[name]);
    if (missing.length > 0) {
        console.error(`Missing arguments: ${missing.join(", ")}`);
        args.keyfile = args.keyfile || "serviceaccount.json";
        args.endpoint = args.endpoint || "[service-name].endpoints.[google-project].cloud.goog";
        console.error(`Usage: esp-runner ${args.command} -${Object.keys(args).filter(n => n !== "command").map(k => k + "=" + args[k]).join(" -")}`);
        process.exit(1);
    }

    keypath = path.dirname(path.resolve(args.keyfile));
    keyfile = path.basename(args.keyfile);
    version = child.execSync(`gcloud endpoints services describe ${args.endpoint} --format='value(serviceConfig.id)'`)
        .toString().trim();
    console.log(`version = ${version}`)
}

const runCmd = `docker run %opts --name="esp" -p ${args["esp-port"]}:${args["esp-port"]} -v ${keypath}:/esp ` +
    "gcr.io/endpoints-release/endpoints-runtime:1 ";
let runArgs = `-s ${args.endpoint} -v ${version} ` +
    `-p ${args["esp-port"]} -a ${args.protocol}://${getLocalIpAddress()}:${args["app-port"]} -k /esp/${keyfile}`;

if (args['print-primitive'] === 'true') {
    runArgs += ' --transcoding_always_print_primitive_fields'
}

function stop() {
    try { child.execSync("docker stop esp"); }
    catch (ex) { console.error(ex.message); }
    try { child.execSync("docker rm esp"); }
    catch (ex) { console.error(ex.message); }
}

switch(args.command) {
    case "start": {
        stop();
        child.execSync(runCmd.replace(/%opts/, "-d") + runArgs);
        console.log(`Running on https://127.0.0.1:${args["esp-port"]}`);
        break;
    }
    case "run": {
        stop();
        console.log(runCmd.replace(/%opts/, "") + runArgs);
        console.log(`Running on https://127.0.0.1:${args["esp-port"]}`);
        child.execSync(runCmd.replace(/%opts/, "") + runArgs, { stdio: "inherit" });
        break;
    }
    case "debug": {
        stop();
        console.log(`Run the following to start the esp service:\n$ start_esp ${runArgs}`);
        child.execSync(runCmd.replace(/%opts/, "-it --entrypoint /bin/bash"), { stdio: "inherit" });
        break;
    }
    case "stop": {
        stop();
        break;
    }
    default: {
        console.error(`Unknown command "${args.command}", see esp-runner -help for more info.`);
    }
}
