#!/bin/sh
# This script transforms the Orion client repo into a form suitable for publishing Orionode to npm.
#
# Usage: ./make-publish repo_dir publish_dir
#
# Where repo_dir is the folder where your orion.client repository lives and publish_dir is 
# the target folder for the publishable Orionode. If the script completes with no errors, you 
# should be able to run `npm publish` from publish_dir to update Orionode.
#
die() {
    echo >&2 "$@"
    exit 1
}

ensure_dir() {
	if [ ! -d "$1" ]; then
		echo mkdir $1
		mkdir "$1"
	fi
}

USAGE="Usage: publish [repo dir] [publish dir]"
[ "$#" -eq 2 ] || die "$USAGE"
[ "$1" != "$2" ] || die "repo dir and publish dir must be different."

REPO=$1
STAGING=$2

ensure_dir "$STAGING"

# Copy bundles to staging
echo Copying $REPO/bundles to $STAGING
ensure_dir "$STAGING"/bundles
cp -r "$REPO"/bundles/* "$STAGING"/bundles/

# Copy modules/orionode/* to staging, but omit unwanted node_modules
echo Copying $REPO/modules/orionode to $STAGING
for f in "$REPO"/modules/orionode/* ; do
	cp -r "$f" "$STAGING"
done
# The * construct above omits things whose name begins with dot (.)
# But we need .gitignore, it's important for npm, so copy it over.
cp "$REPO"/modules/orionode/.gitignore $STAGING

# unnecessary: these are ignored via .gitignore
# delete .workspace/
# delete build/.temp/

# Remove unneeded bundles
echo Removing unneeded bundles
rm -rf "$STAGING"/bundles/org.eclipse.orion.client.git
rm -rf "$STAGING"/bundles/org.eclipse.orion.client.git.greasemonkey
rm -rf "$STAGING"/bundles/org.eclipse.orion.client.users

# Move bundles/ into lib/orion.client/
ensure_dir "$STAGING"/lib/orion.client
ensure_dir "$STAGING"/lib/orion.client/bundles
cp -r "$STAGING"/bundles/* "$STAGING"/lib/orion.client/bundles
rm -rf "$STAGING"/bundles/

echo Rewriting ORION_CLIENT path in index.js
# All we want to do is find the ORION_CLIENT line and replace '../../' with './lib/orion.client/' but unfortunately we are using sh and sed
# Tried breaking it into parts but string quoting makes this fail:
	#FIND="ORION_CLIENT = path.normalize(path.join(__dirname, '\''..\/..\/'\''))"
	#REPLACE="ORION_CLIENT = path.normalize(path.join(__dirname, '\''.\/lib\/orion.client\/'\''))"
	# sed -e 's/${FIND2}/${REPLACE2}/' index.js > sjs.tmp && mv sjs.tmp index.js
sed -e 's/ORION_CLIENT = path.normalize(path.join(__dirname, '\''..\/..\/'\''))/ORION_CLIENT = path.normalize(path.join(__dirname, '\''.\/lib\/orion.client\/'\''))/' "$STAGING"/index.js > "$STAGING"/sjs.tmp && mv "$STAGING"/sjs.tmp "$STAGING"/index.js
echo Done.
