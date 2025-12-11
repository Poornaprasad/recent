export default function AuthLayout({

  children,

}: {

  children: React.ReactNode;

}) {

  return (

    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">

      {/* Gradient Background with Animation */}

      <div className="absolute inset-0 bg-gradient-to-br from-[#293B5F] via-[#1e2d47] to-[#308585] animate-gradient-shift"></div>

      

      {/* Animated gradient overlay for depth */}

      <div className="absolute inset-0 bg-gradient-to-tr from-[#308585]/20 via-transparent to-[#293B5F]/30 animate-pulse-slow"></div>

      

      {/* Subtle pattern overlay */}

      <div 

        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.02]"

        style={{

          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,

          backgroundSize: '40px 40px'

        }}

      ></div>

      
      {/* Floating orbs for visual interest */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#308585]/10 rounded-full blur-3xl animate-float-delayed"></div>

      {/* Content */}

      <main className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">{children}</main>

    </div>

  );

}
