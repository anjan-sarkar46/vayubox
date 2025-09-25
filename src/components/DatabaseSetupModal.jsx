import React, { useState } from 'react';
import { Alert, Button, Card, Modal, Spinner } from 'react-bootstrap';
import { FaDatabase, FaExternalLinkAlt, FaCopy, FaCheck } from 'react-icons/fa';

const DatabaseSetupModal = ({ show, onHide }) => {
  const [copied, setCopied] = useState(false);
  
  const sqlScript = `-- Vayubox Activity History Table Setup
CREATE TABLE IF NOT EXISTS vayubox_activity_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT,
    action TEXT NOT NULL CHECK (action IN ('Upload', 'Download', 'Delete', 'Rename', 'Move', 'Restore')),
    item_name TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_count INTEGER DEFAULT 1,
    folder_path TEXT,
    bucket_name TEXT,
    storage_class TEXT DEFAULT 'STANDARD',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_user_id ON vayubox_activity_history(user_id);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_created_at ON vayubox_activity_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vayubox_activity_action ON vayubox_activity_history(action);

-- Enable RLS
ALTER TABLE vayubox_activity_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Vayubox users can view own activity history" ON vayubox_activity_history
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Vayubox users can insert own activity history" ON vayubox_activity_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);`;

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL:', err);
    }
  };

  const openSupabase = () => {
    window.open('https://app.supabase.com', '_blank');
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="bg-warning text-dark">
        <Modal.Title>
          <FaDatabase className="me-2" />
          Database Setup Required
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="warning" className="mb-4">
          <h5>⚠️ Vayubox Database Table Missing</h5>
          <p className="mb-0">
            The <code>vayubox_activity_history</code> table doesn't exist in your Supabase database. 
            You need to create it to enable activity tracking.
          </p>
        </Alert>

        <Card className="mb-4">
          <Card.Header>
            <h6 className="mb-0">Quick Setup Steps</h6>
          </Card.Header>
          <Card.Body>
            <ol className="mb-0">
              <li className="mb-2">
                <Button variant="outline-primary" size="sm" onClick={openSupabase} className="me-2">
                  <FaExternalLinkAlt className="me-1" />
                  Open Supabase
                </Button>
                Go to your Supabase dashboard
              </li>
              <li className="mb-2">Click <strong>"SQL Editor"</strong> in the left sidebar</li>
              <li className="mb-2">Click <strong>"New Query"</strong></li>
              <li className="mb-2">
                <Button 
                  variant={copied ? "success" : "outline-secondary"} 
                  size="sm" 
                  onClick={handleCopySQL}
                  className="me-2"
                >
                  {copied ? <FaCheck className="me-1" /> : <FaCopy className="me-1" />}
                  {copied ? "Copied!" : "Copy SQL"}
                </Button>
                Copy and paste the SQL script below
              </li>
              <li className="mb-0">Click <strong>"RUN"</strong> to execute the script</li>
            </ol>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">SQL Script for Vayubox Table</h6>
            <Button 
              variant={copied ? "success" : "outline-secondary"} 
              size="sm" 
              onClick={handleCopySQL}
            >
              {copied ? <FaCheck className="me-1" /> : <FaCopy className="me-1" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </Card.Header>
          <Card.Body>
            <pre style={{ 
              fontSize: '12px', 
              maxHeight: '300px', 
              overflow: 'auto',
              backgroundColor: '#f8f9fa',
              padding: '15px',
              border: '1px solid #dee2e6',
              borderRadius: '4px'
            }}>
              {sqlScript}
            </pre>
          </Card.Body>
        </Card>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          I'll Do This Later
        </Button>
        <Button variant="primary" onClick={openSupabase}>
          <FaExternalLinkAlt className="me-1" />
          Open Supabase Dashboard
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DatabaseSetupModal;