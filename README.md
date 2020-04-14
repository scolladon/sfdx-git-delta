# SFDX-Git-Delta 

## What is it?

**SFDX-Git-Delta** (*a.k.a. **sgd***) helps Technical Architects accomplish 2 things with their CI deployments:

1. **Make deployments faster,** by identifying the metadata that has been changed since a reference commit.
2. **Automate destructive deployments**, by listing the deleted (or renamed) metadata in a destructivePackage.xml

## Is it for me?

If you are not a Salesforce Architect, probably not, _sorry_.

If you are a Technical Architect, then it’s a very useful tool for you, _when the 3 conditions below are met:_

        Your Salesforce project uses a git repo as the source of truth.
                ➕
        You use the new **Source (DX) format in the repo.
                ➕
        You have a CI/CD pipeline (Jenkins, Bitbucket Pipelines, GitLab CI...) that handles the deployment of the sources to the salesforce org(s).


**DISCLAIMER:**

⚠️ **SFDX-Git-Delta is _not_ an officially supported tool ⚠️**

👷 Use it at your own risk, wear a helmet, and do not let non-technical people play with it 🔥


## How to install it?

```
npm install sfdx-git-delta@latest -g
```

If you run your CI jobs inside a Docker image (which is very common), you can add sgd to you image, such as in this example: https://hub.docker.com/r/mehdisfdc/sfdx-cli-gitlab/dockerfile


To see the full list and description of the sgd options, run `sgd --help`

```
-V, --version output the version number
-t, --to [sha] commit sha to where the diff is done [HEAD] (default: "HEAD")
-f, --from [sha] commit sha from where the diff is done [git rev-list —max-parents=0 HEAD]
-o, --output [dir] source package specific output [./output] (default: "./output")
-a, --api-version [version] salesforce API version [48] (default: "48")
-r, --repo [dir] git repository location [./repo] (default: "./repo")
-d, --generate-delta generate delta files in [./output] folder
-h, --help output usage information
```



## How to use it?

### **TLDR;**

```
sgd --to HEAD --from HEAD^ --repo . --output .
```

```
echo "--- package.xml generated with added and modified metadata ---"
cat packages/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x packages/package.xml
```

```
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"     
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```



### Scenario:

Let’s take to following scenario: 

> ***The CI pipelines deploys the sources to Production anytime there is a new commit in the master branch.***


In our example, the latest commit to master is composed of:
+ _Apex Class added:_ TriggerHandler
+ _Apex Class added:_ TriggerHandler_Test
+ _Apex Class modified:_ TestDataFactory
+ _Apex Class deleted:_ AnotherTriggerFramework

![commit](/img/example_commit.png)

In this situation, we would expect the CI pipeline to:

1. **Deploy to Production only 3 classes** (no matter how much metadata is present in the force-app folder): TriggerHandler; TriggerHandler_Test; TestDataFactory
2. **Delete from Production 1 classe**: AnotherTriggerFramework

So let’s do it!


### Run the sgd command:

From the project repo folder, the CI pipeline will run the following command

```
sgd --to HEAD --from HEAD^ --repo . --output .
```

which means:

> Analyse the difference between HEAD (latest commit) and HEAD^ (previous commit), from the current folder, and output the result in the same folder.


_This will generate 2 very usefull artefacts :_

**1) A `package.xml` file, inside a `package` folder.** This package.xml file contains only the metadata that has been added and changed, and that needs to be deployed in the target org.

*Content of the `package.xml` file in our scenario:*
![package](/img/example_package.png)

**2) A `destructivePackage.xml` file, inside a `destructivePackage` folder.** This destructivePackage.xml file contains only the metadata that has been removed or renamed, and that needs to be deleted from the target org.

*Content of the `destructivePackage.xml` file in our scenario:*
![destructivePackage](/img/example_destructiveChange.png)

If needed, we could also have generated a copy of the force-app folder with only the added and changed metadata, by using the `--generate-delta` option. Run `sgd --help` to review all the options that `sgd` accepts.



### Deploy only the added/modified metadata:

The CI pipeline can use the `package/package.xml` file to deploy only this subset of metadata:

```
echo "--- package.xml generated with added and modified metadata ---"
cat packages/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x packages/package.xml
```



### Delete the removed metadata:

The CI pipeline can use the `destructiveChanges` folder to deploy the corresponding destructive change:

```
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"     
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```


And voilà! 🥳