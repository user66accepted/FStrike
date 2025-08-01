import React from 'react'
import Header from '../components/Header'
import LoginCard from '../components/LoginCard'

function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden">
            {/* Cyber Grid Background */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(0,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }}></div>
            </div>

            {/* Animated Background Elements */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-cyber-primary/5 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-20 right-20 w-40 h-40 bg-cyber-secondary/5 rounded-full blur-xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-cyber-accent/5 rounded-full blur-xl animate-pulse delay-500"></div>

            <Header />
            
            <div className='flex flex-col lg:flex-row gap-16 items-center justify-center min-h-[calc(100vh-80px)] px-8'>
                {/* Logo Section */}
                <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                        <img 
                            src="./logo.jpg" 
                            alt="F-Strike Logo" 
                            className='w-80 h-80 relative z-10 rounded-2xl border border-cyber-primary/30 filter invert' 
                        />
                    </div>
                    <div className="text-center space-y-2">
                        <h1 className="text-4xl font-bold text-cyber-primary tracking-tight">F-Strike</h1>
                        <p className="text-cyber-muted max-w-md">Cyber Reconnaissance & Exploitation Platform</p>
                        <div className="flex items-center justify-center space-x-2 mt-4">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-cyber-muted font-mono">SYSTEM ONLINE</span>
                        </div>
                    </div>
                </div>

                {/* Login Card */}
                <div>
                    <LoginCard />
                </div>
            </div>
        </div>
    )
}

export default LoginPage