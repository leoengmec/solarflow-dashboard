export default function Layout({ children, currentPageName }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <style>{`
        * { box-sizing: border-box; }
        body { background: #f9fafb; }
        .font-sans { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
      `}</style>
      {children}
    </div>
  );
}