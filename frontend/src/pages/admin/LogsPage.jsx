import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function LogsPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    const q = query(
      collection(db, "adminLogs"),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const snap = await getDocs(q);

    setLogs(
      snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Admin Activity Logs</h2>

      <table width="100%" border="1">
        <thead>
          <tr>
            <th>Admin</th>
            <th>Action</th>
            <th>Target</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{log.adminName}</td>
              <td>{log.action}</td>
              <td>{log.targetUid}</td>
              <td>{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
