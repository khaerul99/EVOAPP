export const EVENT_ENDPOINT = '/cgi-bin/eventManager.cgi?action=attach'
export const CONFIG_ENDPOINT = '/cgi-bin/configManager.cgi'

export const MENU_CONFIG = [
    {
        key: 'peopleCounting',
        title: 'People Counting',
        subtitle: 'NumberStat',
        endpoint: CONFIG_ENDPOINT,
        eventCodes: [],
        panelType: 'peopleCounting',
        peopleTabs: ['People Counting'],
        dataRows: [
            { key: 'numberStat', label: 'NumberStat', eventCode: 'NumberStat' },
        ],
    },
    {
        key: 'faceDetection',
        title: 'Face Detection',
        subtitle: 'FaceDetection',
        endpoint: EVENT_ENDPOINT,
        eventCodes: ['FaceDetection'],
        dataRows: [
            { key: 'faceDetection', label: 'FaceDetection', eventCode: 'FaceDetection' },
        ],
    },
    {
        key: 'videoMetadata',
        title: 'Video Metadata',
        subtitle: 'VideoMetadata',
        endpoint: EVENT_ENDPOINT,
        eventCodes: ['VideoMetadata'],
        dataRows: [
            { key: 'videoMetadata', label: 'VideoMetadata', eventCode: 'VideoMetadata' },
        ],
    },
    {
        key: 'ivs',
        title: 'IVS (Tripwire/Area)',
        subtitle: 'CrossLineDetection, Intrusion',
        endpoint: EVENT_ENDPOINT,
        eventCodes: ['CrossLineDetection', 'Intrusion'],
        dataRows: [
            { key: 'crossLineDetection', label: 'CrossLineDetection', eventCode: 'CrossLineDetection' },
            { key: 'intrusion', label: 'Intrusion', eventCode: 'Intrusion' },
        ],
    },
    {
        key: 'smartMotion',
        title: 'Smart Motion (SMD)',
        subtitle: 'SmartMotionHuman, SmartMotionVehicle',
        endpoint: EVENT_ENDPOINT,
        eventCodes: ['SmartMotionHuman', 'SmartMotionVehicle'],
        dataRows: [
            { key: 'smartMotionHuman', label: 'SmartMotionHuman', eventCode: 'SmartMotionHuman' },
            { key: 'smartMotionVehicle', label: 'SmartMotionVehicle', eventCode: 'SmartMotionVehicle' },
        ],
    },
    {
        key: 'motionDetection',
        title: 'Motion Detection',
        subtitle: 'VideoMotion',
        endpoint: EVENT_ENDPOINT,
        eventCodes: ['VideoMotion'],
        dataRows: [
            { key: 'videoMotion', label: 'VideoMotion', eventCode: 'VideoMotion' },
        ],
    },
]
