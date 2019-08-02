'use strict';
const metadata = [
    {
        "directoryName": "installedPackages",
        "inFolder": false,
        "metaFile": false,
        "suffix": "installedPackage",
        "xmlName": "InstalledPackage"
    },
    {
        "childXmlNames": "CustomLabel",
        "directoryName": "labels",
        "inFolder": false,
        "metaFile": false,
        "suffix": "labels",
        "xmlName": "CustomLabels"
    },
    {
        "directoryName": "staticresources",
        "inFolder": false,
        "metaFile": true,
        "suffix": "resource",
        "xmlName": "StaticResource"
    },
    {
        "directoryName": "scontrols",
        "inFolder": false,
        "metaFile": true,
        "suffix": "scf",
        "xmlName": "Scontrol"
    },
    {
        "directoryName": "certs",
        "inFolder": false,
        "metaFile": true,
        "suffix": "crt",
        "xmlName": "Certificate"
    },
    {
        "directoryName": "aura",
        "inFolder": false,
        "metaFile": false,
        "xmlName": "AuraDefinitionBundle"
    },
    {
        "directoryName": "lwc",
        "inFolder": false,
        "metaFile": false,
        "xmlName": "LightningComponentBundle"
    },
    {
        "directoryName": "components",
        "inFolder": false,
        "metaFile": true,
        "suffix": "component",
        "xmlName": "ApexComponent"
    },
    {
        "directoryName": "pages",
        "inFolder": false,
        "metaFile": true,
        "suffix": "page",
        "xmlName": "ApexPage"
    },
    {
        "directoryName": "queues",
        "inFolder": false,
        "metaFile": false,
        "suffix": "queue",
        "xmlName": "Queue"
    },
    {
        "directoryName": "CaseSubjectParticles",
        "inFolder": false,
        "metaFile": false,
        "suffix": "CaseSubjectParticle",
        "xmlName": "CaseSubjectParticle"
    },
    {
        "directoryName": "dataSources",
        "inFolder": false,
        "metaFile": false,
        "suffix": "dataSource",
        "xmlName": "ExternalDataSource"
    },
    {
        "directoryName": "namedCredentials",
        "inFolder": false,
        "metaFile": false,
        "suffix": "namedCredential",
        "xmlName": "NamedCredential"
    },
    {
        "directoryName": "externalServiceRegistrations",
        "inFolder": false,
        "metaFile": false,
        "suffix": "externalServiceRegistration",
        "xmlName": "ExternalServiceRegistration"
    },
    {
        "directoryName": "roles",
        "inFolder": false,
        "metaFile": false,
        "suffix": "role",
        "xmlName": "Role"
    },
    {
        "directoryName": "groups",
        "inFolder": false,
        "metaFile": false,
        "suffix": "group",
        "xmlName": "Group"
    },
    {
        "directoryName": "globalValueSets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "globalValueSet",
        "xmlName": "GlobalValueSet"
    },
    {
        "directoryName": "standardValueSets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "standardValueSet",
        "xmlName": "StandardValueSet"
    },
    {
        "directoryName": "customPermissions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "customPermission",
        "xmlName": "CustomPermission"
    },
    {
        "childXmlNames": [
            "CustomField",
            "Index",
            "BusinessProcess",
            "RecordType",
            "CompactLayout",
            "WebLink",
            "ValidationRule",
            "SharingReason",
            "ListView",
            "FieldSet"
        ],
        "directoryName": "objects",
        "inFolder": false,
        "metaFile": false,
        "suffix": "object",
        "xmlName": "CustomObject"
    },
    {
        "directoryName": "businessProcesses",
        "inFolder": false,
        "metaFile": false,
        "suffix": "businessProcesse",
        "xmlName": "BusinessProcesse"
    },
    {
        "directoryName": "compactLayouts",
        "inFolder": false,
        "metaFile": false,
        "suffix": "compactLayout",
        "xmlName": "CompactLayout"
    },
    {
        "directoryName": "fields",
        "inFolder": false,
        "metaFile": false,
        "suffix": "field",
        "xmlName": "CustomField"
    },
    {
        "directoryName": "fieldSets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "fieldSet",
        "xmlName": "FieldSet"
    },
    {
        "directoryName": "listViews",
        "inFolder": false,
        "metaFile": false,
        "suffix": "listView",
        "xmlName": "ListView"
    },
    {   
        "directoryName": "recordTypes",
        "inFolder": false,
        "metaFile": false,
        "suffix": "recordType",
        "xmlName": "RecordType"
    },
    {
        "directoryName": "sharingReasons",
        "inFolder": false,
        "metaFile": false,
        "suffix": "sharingReason",
        "xmlName": "SharingReason"
    },
    { 
        "directoryName": "validationRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "validationRule",
        "xmlName": "ValidationRule"
    },
    {
        
        "directoryName": "webLinks",
        "inFolder": false,
        "metaFile": false,
        "suffix": "webLink",
        "xmlName": "WebLink"
    },
    {
        "directoryName": "reportTypes",
        "inFolder": false,
        "metaFile": false,
        "suffix": "reportType",
        "xmlName": "ReportType"
    },
    {
        "directoryName": "reports",
        "inFolder": true,
        "metaFile": false,
        "suffix": "report",
        "xmlName": "Report"
    },
    {
        "directoryName": "dashboards",
        "inFolder": true,
        "metaFile": false,
        "suffix": "dashboard",
        "xmlName": "Dashboard"
    },
    {
        "directoryName": "analyticSnapshots",
        "inFolder": false,
        "metaFile": false,
        "suffix": "snapshot",
        "xmlName": "AnalyticSnapshot"
    },
    {
        "directoryName": "feedFilters",
        "inFolder": false,
        "metaFile": false,
        "suffix": "feedFilter",
        "xmlName": "CustomFeedFilter"
    },
    {
        "directoryName": "layouts",
        "inFolder": false,
        "metaFile": false,
        "suffix": "layout",
        "xmlName": "Layout"
    },
    {
        "directoryName": "documents",
        "inFolder": true,
        "metaFile": true,
        "xmlName": "Document"
    },
    {
        "directoryName": "weblinks",
        "inFolder": false,
        "metaFile": false,
        "suffix": "weblink",
        "xmlName": "CustomPageWebLink"
    },
    {
        "directoryName": "letterhead",
        "inFolder": false,
        "metaFile": false,
        "suffix": "letter",
        "xmlName": "Letterhead"
    },
    {
        "directoryName": "email",
        "inFolder": true,
        "metaFile": true,
        "suffix": "email",
        "xmlName": "EmailTemplate"
    },
    {
        "directoryName": "quickActions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "quickAction",
        "xmlName": "QuickAction"
    },
    {
        "directoryName": "flexipages",
        "inFolder": false,
        "metaFile": false,
        "suffix": "flexipage",
        "xmlName": "FlexiPage"
    },
    {
        "directoryName": "tabs",
        "inFolder": false,
        "metaFile": false,
        "suffix": "tab",
        "xmlName": "CustomTab"
    },
    {
        "directoryName": "customApplicationComponents",
        "inFolder": false,
        "metaFile": false,
        "suffix": "customApplicationComponent",
        "xmlName": "CustomApplicationComponent"
    },
    {
        "directoryName": "applications",
        "inFolder": false,
        "metaFile": false,
        "suffix": "app",
        "xmlName": "CustomApplication"
    },
    {
        "directoryName": "customMetadata",
        "inFolder": false,
        "metaFile": false,
        "suffix": "md",
        "xmlName": "CustomMetadata"
    },
    {
        "directoryName": "flows",
        "inFolder": false,
        "metaFile": false,
        "suffix": "flow",
        "xmlName": "Flow"
    },
    {
        "directoryName": "flowDefinitions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "flowDefinition",
        "xmlName": "FlowDefinition"
    },
    {
        "directoryName": "eventSubscriptions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "subscription",
        "xmlName": "EventSubscription"
    },
    {
        "directoryName": "eventDeliveries",
        "inFolder": false,
        "metaFile": false,
        "suffix": "delivery",
        "xmlName": "EventDelivery"
    },
    {
        "childXmlNames": [
            "WorkflowFieldUpdate",
            "WorkflowKnowledgePublish",
            "WorkflowTask",
            "WorkflowAlert",
            "WorkflowSend",
            "WorkflowOutboundMessage",
            "WorkflowRule"
        ],
        "directoryName": "workflows",
        "inFolder": false,
        "metaFile": false,
        "suffix": "workflow",
        "xmlName": "Workflow"
    },
    {
        "childXmlNames": "AssignmentRule",
        "directoryName": "assignmentRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "assignmentRules",
        "xmlName": "AssignmentRules"
    },
    {
        "childXmlNames": "AutoResponseRule",
        "directoryName": "autoResponseRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "autoResponseRules",
        "xmlName": "AutoResponseRules"
    },
    {
        "childXmlNames": "EscalationRule",
        "directoryName": "escalationRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "escalationRules",
        "xmlName": "EscalationRules"
    },
    {
        "directoryName": "postTemplates",
        "inFolder": false,
        "metaFile": false,
        "suffix": "postTemplate",
        "xmlName": "PostTemplate"
    },
    {
        "directoryName": "approvalProcesses",
        "inFolder": false,
        "metaFile": false,
        "suffix": "approvalProcess",
        "xmlName": "ApprovalProcess"
    },
    {
        "directoryName": "homePageComponents",
        "inFolder": false,
        "metaFile": false,
        "suffix": "homePageComponent",
        "xmlName": "HomePageComponent"
    },
    {
        "directoryName": "homePageLayouts",
        "inFolder": false,
        "metaFile": false,
        "suffix": "homePageLayout",
        "xmlName": "HomePageLayout"
    },
    {
        "directoryName": "objectTranslations",
        "inFolder": false,
        "metaFile": false,
        "suffix": "objectTranslation",
        "xmlName": "CustomObjectTranslation"
    },
    {
        "directoryName": "globalValueSetTranslations",
        "inFolder": false,
        "metaFile": false,
        "suffix": "globalValueSetTranslation",
        "xmlName": "GlobalValueSetTranslation"
    },
    {
        "directoryName": "standardValueSetTranslations",
        "inFolder": false,
        "metaFile": false,
        "suffix": "standardValueSetTranslation",
        "xmlName": "StandardValueSetTranslation"
    },
    {
        "directoryName": "classes",
        "inFolder": false,
        "metaFile": true,
        "suffix": "cls",
        "xmlName": "ApexClass"
    },
    {
        "directoryName": "triggers",
        "inFolder": false,
        "metaFile": true,
        "suffix": "trigger",
        "xmlName": "ApexTrigger"
    },
    {
        "directoryName": "testSuites",
        "inFolder": false,
        "metaFile": false,
        "suffix": "testSuite",
        "xmlName": "ApexTestSuite"
    },
    {
        "directoryName": "profiles",
        "inFolder": false,
        "metaFile": false,
        "suffix": "profile",
        "xmlName": "Profile"
    },
    {
        "directoryName": "permissionsets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "permissionset",
        "xmlName": "PermissionSet"
    },
    {
        "directoryName": "profilePasswordPolicies",
        "inFolder": false,
        "metaFile": false,
        "suffix": "profilePasswordPolicy",
        "xmlName": "ProfilePasswordPolicy"
    },
    {
        "directoryName": "profileSessionSettings",
        "inFolder": false,
        "metaFile": false,
        "suffix": "profileSessionSetting",
        "xmlName": "ProfileSessionSetting"
    },
    {
        "directoryName": "datacategorygroups",
        "inFolder": false,
        "metaFile": false,
        "suffix": "datacategorygroup",
        "xmlName": "DataCategoryGroup"
    },
    {
        "directoryName": "remoteSiteSettings",
        "inFolder": false,
        "metaFile": false,
        "suffix": "remoteSite",
        "xmlName": "RemoteSiteSetting"
    },
    {
        "directoryName": "cspTrustedSites",
        "inFolder": false,
        "metaFile": false,
        "suffix": "cspTrustedSite",
        "xmlName": "CspTrustedSite"
    },
    {
        "childXmlNames": "MatchingRule",
        "directoryName": "matchingRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "matchingRule",
        "xmlName": "MatchingRules"
    },
    {
        "directoryName": "duplicateRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "duplicateRule",
        "xmlName": "DuplicateRule"
    },
    {
        "directoryName": "cleanDataServices",
        "inFolder": false,
        "metaFile": false,
        "suffix": "cleanDataService",
        "xmlName": "CleanDataService"
    },
    {
        "directoryName": "authproviders",
        "inFolder": false,
        "metaFile": false,
        "suffix": "authprovider",
        "xmlName": "AuthProvider"
    },
    {
        "directoryName": "eclair",
        "inFolder": false,
        "metaFile": true,
        "suffix": "geodata",
        "xmlName": "EclairGeoData"
    },
    {
        "directoryName": "sites",
        "inFolder": false,
        "metaFile": false,
        "suffix": "site",
        "xmlName": "CustomSite"
    },
    {
        "directoryName": "channelLayouts",
        "inFolder": false,
        "metaFile": false,
        "suffix": "channelLayout",
        "xmlName": "ChannelLayout"
    },
    {
        "directoryName": "contentassets",
        "inFolder": false,
        "metaFile": true,
        "suffix": "asset",
        "xmlName": "ContentAsset"
    },
    {
        "childXmlNames": [
            "SharingOwnerRule",
            "SharingCriteriaRule"
        ],
        "directoryName": "sharingRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "sharingRules",
        "xmlName": "SharingRules"
    },
    {
        "directoryName": "sharingSets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "sharingSet",
        "xmlName": "SharingSet"
    },
    {
        "directoryName": "communities",
        "inFolder": false,
        "metaFile": false,
        "suffix": "community",
        "xmlName": "Community"
    },
    {
        "directoryName": "ChatterExtensions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "ChatterExtension",
        "xmlName": "ChatterExtension"
    },
    {
        "directoryName": "platformEventChannels",
        "inFolder": false,
        "metaFile": false,
        "suffix": "platformEventChannel",
        "xmlName": "PlatformEventChannel"
    },
    {
        "directoryName": "callCenters",
        "inFolder": false,
        "metaFile": false,
        "suffix": "callCenter",
        "xmlName": "CallCenter"
    },
    {
        "directoryName": "notificationtypes",
        "inFolder": false,
        "metaFile": false,
        "suffix": "notiftype",
        "xmlName": "CustomNotificationType"
    },
    {
        "directoryName": "connectedApps",
        "inFolder": false,
        "metaFile": false,
        "suffix": "connectedApp",
        "xmlName": "ConnectedApp"
    },
    {
        "directoryName": "appMenus",
        "inFolder": false,
        "metaFile": false,
        "suffix": "appMenu",
        "xmlName": "AppMenu"
    },
    {
        "directoryName": "delegateGroups",
        "inFolder": false,
        "metaFile": false,
        "suffix": "delegateGroup",
        "xmlName": "DelegateGroup"
    },
    {
        "directoryName": "siteDotComSites",
        "inFolder": false,
        "metaFile": true,
        "suffix": "site",
        "xmlName": "SiteDotCom"
    },
    {
        "directoryName": "networks",
        "inFolder": false,
        "metaFile": false,
        "suffix": "network",
        "xmlName": "Network"
    },
    {
        "directoryName": "networkBranding",
        "inFolder": false,
        "metaFile": true,
        "suffix": "networkBranding",
        "xmlName": "NetworkBranding"
    },
    {
        "directoryName": "audience",
        "inFolder": false,
        "metaFile": false,
        "suffix": "audience",
        "xmlName": "Audience"
    },
    {
        "directoryName": "brandingSets",
        "inFolder": false,
        "metaFile": false,
        "suffix": "brandingSet",
        "xmlName": "BrandingSet"
    },
    {
        "directoryName": "communityThemeDefinitions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "communityThemeDefinition",
        "xmlName": "CommunityThemeDefinition"
    },
    {
        "directoryName": "communityTemplateDefinitions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "communityTemplateDefinition",
        "xmlName": "CommunityTemplateDefinition"
    },
    {
        "directoryName": "flowCategories",
        "inFolder": false,
        "metaFile": false,
        "suffix": "flowCategory",
        "xmlName": "FlowCategory"
    },
    {
        "directoryName": "lightningBolts",
        "inFolder": false,
        "metaFile": false,
        "suffix": "lightningBolt",
        "xmlName": "LightningBolt"
    },
    {
        "directoryName": "lightningExperienceThemes",
        "inFolder": false,
        "metaFile": false,
        "suffix": "lightningExperienceTheme",
        "xmlName": "LightningExperienceTheme"
    },
    {
        "directoryName": "customHelpMenuSections",
        "inFolder": false,
        "metaFile": false,
        "suffix": "customHelpMenuSection",
        "xmlName": "CustomHelpMenuSection"
    },
    {
        "childXmlNames": "ManagedTopic",
        "directoryName": "managedTopics",
        "inFolder": false,
        "metaFile": false,
        "suffix": "managedTopics",
        "xmlName": "ManagedTopics"
    },
    {
        "directoryName": "accountRelationshipShareRules",
        "inFolder": false,
        "metaFile": false,
        "suffix": "accountRelationshipShareRule",
        "xmlName": "AccountRelationshipShareRule"
    },
    {
        "directoryName": "moderation",
        "inFolder": false,
        "metaFile": false,
        "suffix": "keywords",
        "xmlName": "KeywordList"
    },
    {
        "directoryName": "userCriteria",
        "inFolder": false,
        "metaFile": false,
        "suffix": "userCriteria",
        "xmlName": "UserCriteria"
    },
    {
        "directoryName": "moderation",
        "inFolder": false,
        "metaFile": false,
        "suffix": "rule",
        "xmlName": "ModerationRule"
    },
    {
        "directoryName": "cmsConnectSource",
        "inFolder": false,
        "metaFile": false,
        "suffix": "cmsConnectSource",
        "xmlName": "CMSConnectSource"
    },
    {
        "directoryName": "territory2Types",
        "inFolder": false,
        "metaFile": false,
        "suffix": "territory2Type",
        "xmlName": "Territory2Type"
    },
    {
        "directoryName": "territory2Models",
        "inFolder": false,
        "metaFile": false,
        "suffix": "territory2Model",
        "xmlName": "Territory2Model"
    },
    {
        "directoryName": "territory2Models",
        "inFolder": false,
        "metaFile": false,
        "suffix": "territory2Rule",
        "xmlName": "Territory2Rule"
    },
    {
        "directoryName": "territory2Models",
        "inFolder": false,
        "metaFile": false,
        "suffix": "territory2",
        "xmlName": "Territory2"
    },
    {
        "directoryName": "samlssoconfigs",
        "inFolder": false,
        "metaFile": false,
        "suffix": "samlssoconfig",
        "xmlName": "SamlSsoConfig"
    },
    {
        "directoryName": "corsWhitelistOrigins",
        "inFolder": false,
        "metaFile": false,
        "suffix": "corsWhitelistOrigin",
        "xmlName": "CorsWhitelistOrigin"
    },
    {
        "directoryName": "actionLinkGroupTemplates",
        "inFolder": false,
        "metaFile": false,
        "suffix": "actionLinkGroupTemplate",
        "xmlName": "ActionLinkGroupTemplate"
    },
    {
        "directoryName": "transactionSecurityPolicies",
        "inFolder": false,
        "metaFile": false,
        "suffix": "transactionSecurityPolicy",
        "xmlName": "TransactionSecurityPolicy"
    },
    {
        "directoryName": "synonymDictionaries",
        "inFolder": false,
        "metaFile": false,
        "suffix": "synonymDictionary",
        "xmlName": "SynonymDictionary"
    },
    {
        "directoryName": "pathAssistants",
        "inFolder": false,
        "metaFile": false,
        "suffix": "pathAssistant",
        "xmlName": "PathAssistant"
    },
    {
        "directoryName": "LeadConvertSettings",
        "inFolder": false,
        "metaFile": false,
        "suffix": "LeadConvertSetting",
        "xmlName": "LeadConvertSettings"
    },
    {
        "directoryName": "cachePartitions",
        "inFolder": false,
        "metaFile": false,
        "suffix": "cachePartition",
        "xmlName": "PlatformCachePartition"
    },
    {
        "directoryName": "topicsForObjects",
        "inFolder": false,
        "metaFile": false,
        "suffix": "topicsForObjects",
        "xmlName": "TopicsForObjects"
    },
    {
        "directoryName": "recommendationStrategies",
        "inFolder": false,
        "metaFile": false,
        "suffix": "recommendationStrategy",
        "xmlName": "RecommendationStrategy"
    },
    {
        "directoryName": "iot",
        "inFolder": false,
        "metaFile": false,
        "suffix": "orchestrationContext",
        "xmlName": "OrchestrationContext"
    },
    {
        "directoryName": "emailservices",
        "inFolder": false,
        "metaFile": false,
        "suffix": "xml",
        "xmlName": "EmailServicesFunction"
    },
    {
        "directoryName": "recordActionDeployments",
        "inFolder": false,
        "metaFile": false,
        "suffix": "deployment",
        "xmlName": "RecordActionDeployment"
    },
    {
        "directoryName": "EmbeddedServiceConfig",
        "inFolder": false,
        "metaFile": false,
        "suffix": "EmbeddedServiceConfig",
        "xmlName": "EmbeddedServiceConfig"
    },
    {
        "directoryName": "EmbeddedServiceBranding",
        "inFolder": false,
        "metaFile": false,
        "suffix": "EmbeddedServiceBranding",
        "xmlName": "EmbeddedServiceBranding"
    },
    {
        "directoryName": "EmbeddedServiceFlowConfig",
        "inFolder": false,
        "metaFile": false,
        "suffix": "EmbeddedServiceFlowConfig",
        "xmlName": "EmbeddedServiceFlowConfig"
    },
    {
        "directoryName": "settings",
        "inFolder": false,
        "metaFile": false,
        "suffix": "settings",
        "xmlName": "Settings"
    }
]

module.exports = (grouping) => metadata.reduce((p,c)=>{p[c[grouping]]=c; return p},{})