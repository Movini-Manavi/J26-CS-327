import React, { PropsWithChildren } from 'react';
import Navbar from '../atoms/navbar';

const ChatLayout: React.FC<PropsWithChildren> = ({ children }) => (
  <div className="h-screen overflow-hidden">
    <Navbar />
    <div className="mt-14 h-[calc(100vh-56px)]">{children}</div>
  </div>
);

export default ChatLayout;
