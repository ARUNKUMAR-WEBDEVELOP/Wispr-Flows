import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children }) {
  return (
    <div className="h-screen w-screen flex bg-[#0b0f19] text-white">
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="flex flex-col flex-1">
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-[#0f172a]">
          {children}
        </main>
      </div>

    </div>
  );
}
