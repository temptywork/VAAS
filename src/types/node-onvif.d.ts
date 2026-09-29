declare module 'node-onvif' {
  interface OnvifDeviceOptions {
    xaddr: string;
    user?: string;
    pass?: string;
  }

  const nodeOnvif: {
    OnvifDevice: new (options: OnvifDeviceOptions) => any;
  };

  export default nodeOnvif;
}

declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export default Hls;
}
