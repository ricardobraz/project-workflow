pushd output\MSBuildVSCodeExtension
call ..\node_modules\.bin\mocha --ui tdd %*
popd