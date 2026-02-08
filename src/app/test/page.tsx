export default function TestPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Test Page</h1>
      <p>If you can see this, the server is working!</p>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
}
