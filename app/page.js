'use client';
import dynamic from 'next/dynamic';
const LiveOrders = dynamic(() => import('../components/LiveOrders'), { ssr: false });
export default function Home() { return <LiveOrders />; }
