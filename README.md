# esp-runner

A small utility for running esp in docker.

## Usage:

    esp-runner (command) -arg=value (-arg=value )+

## Commands:

	start, run, debug

## Arguments:

    -endpoint=[service-name].endpoints.[google-project].cloud.goog
    -keyfile=serviceaccount.json # service account json key
    -esp-port=8000  # Port number for esp to listen on
    -app-port=8080  # Port number your application is listening on
    -protocol=grpc|http|https

## Example:

    esp-runner run -endpoint=[service-name].endpoints.[google-project].cloud.goog \\
        -keyfile=serviceaccount.json -esp-port=8000 -app-port=8080 -protocol=grpc
