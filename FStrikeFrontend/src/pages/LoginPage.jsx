import React from 'react'
import Header from '../components/Header'
import LoginCard from '../components/LoginCard'
import Sidebar from '../components/Sidebar'

function LoginPage() {
    return (
        <div>
            <Header />
            <div className='flex flex-row gap-60 items-center justify-center -mt-[50px]'>
                <div>
                    <img src="./logo.jpg" alt="logo" className='w-80 h-80' />
                </div>
                <div>
                    <LoginCard />
                </div>
            </div>
        </div>
    )
}

export default LoginPage