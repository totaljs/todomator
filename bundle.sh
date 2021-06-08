mkdir -p .bundle/

cd .bundle
cp -a ../controllers/ controllers
cp -a ../databases/ databases
cp -a ../definitions/ definitions
cp -a ../jsonschemas/ jsonschemas
cp -a ../operations/ operations
cp -a ../public/ public
cp -a ../schemas/ schemas
cp -a ../views/ views

total4 --bundle ../app.bundle

cd ..
rm -rf .bundle
echo "DONE"