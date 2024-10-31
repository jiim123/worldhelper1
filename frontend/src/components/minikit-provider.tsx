import { ReactNode, useEffect } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

interface MiniKitProviderProps {
  children: ReactNode;
}

export default function MiniKitProvider({ children }: MiniKitProviderProps) {
  useEffect(() => {
    const initMiniKit = async () => {
      try {
        await MiniKit.install();
        const isInstalled = MiniKit.isInstalled();
        console.log('Running in World App:', isInstalled);
      } catch (error) {
        console.error('MiniKit initialization error:', error);
      }
    };

    initMiniKit();
  }, []);

  return <>{children}</>;
}