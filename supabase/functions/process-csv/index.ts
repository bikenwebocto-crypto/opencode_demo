// Supabase Edge Function: process-csv
// Handles CSV employee import in the background

import { serve } from 'https://deno.land/std@0.210.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';
import { parse } from 'https://esm.sh/csv-parse@5.6.0/sync';

interface CSVRow {
  email: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  department?: string;
  job_title?: string;
  phone?: string;
}

serve(async (req) => {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('csv_upload_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Update status to processing
    await supabase
      .from('csv_upload_jobs')
      .update({ status: 'PROCESSING' })
      .eq('id', jobId);

    // Download CSV file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('csv-uploads')
      .download(job.file_url);

    if (fileError || !fileData) {
      throw new Error('Failed to download CSV file');
    }

    const csvText = await fileData.text();
    const rows: CSVRow[] = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let successCount = 0;
    let errorCount = 0;
    const rejectedRows: Array<{ row: number; reason: string; rowData: CSVRow }> = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for 0-index + header row

      try {
        // Validate email
        if (!row.email || !row.email.includes('@')) {
          throw new Error('Invalid email address');
        }

        // Check for existing employee
        const { data: existing } = await supabase
          .from('employees')
          .select('id')
          .eq('email', row.email)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('employees')
            .update({
              first_name: row.first_name,
              last_name: row.last_name,
              employee_id: row.employee_id,
              department: row.department,
              job_title: row.job_title,
              phone: row.phone,
              status: 'ACTIVE',
            })
            .eq('id', existing.id);
        } else {
          // Create new employee
          const tempPassword = crypto.randomUUID().slice(0, 16);

          // Create auth user
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: row.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              user_type: 'employee',
              company_id: job.company_id,
            },
          });

          if (authError) throw new Error(`Auth creation failed: ${authError.message}`);

          // Create employee record
          await supabase.from('employees').insert({
            id: authUser.user.id,
            company_id: job.company_id,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            employee_id: row.employee_id,
            department: row.department,
            job_title: row.job_title,
            phone: row.phone,
            status: 'ACTIVE',
            invited_at: new Date().toISOString(),
          });

          // Send welcome email with temp password
          // await emailService.sendWelcomeEmail(row.email, tempPassword, row.first_name);
        }

        successCount++;
      } catch (err) {
        errorCount++;
        rejectedRows.push({
          row: rowNumber,
          reason: err instanceof Error ? err.message : 'Unknown error',
          rowData: row,
        });
      }

      // Update progress periodically
      if ((i + 1) % 50 === 0 || i === rows.length - 1) {
        await supabase
          .from('csv_upload_jobs')
          .update({
            processed_rows: i + 1,
            success_count: successCount,
            error_count: errorCount,
          })
          .eq('id', jobId);
      }
    }

    // Insert rejected rows
    if (rejectedRows.length > 0) {
      await supabase.from('csv_rejected_rows').insert(
        rejectedRows.map((r) => ({
          csv_upload_id: jobId,
          row_number: r.row,
          reason: r.reason,
          row_data: r.rowData,
        }))
      );
    }

    // Finalize job
    const finalStatus =
      errorCount === 0
        ? 'COMPLETED'
        : successCount > 0
          ? 'PARTIALLY_COMPLETED'
          : 'FAILED';

    await supabase
      .from('csv_upload_jobs')
      .update({
        status: finalStatus,
        total_rows: rows.length,
        processed_rows: rows.length,
        success_count: successCount,
        error_count: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ success: true, totalRows: rows.length, successCount, errorCount }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('CSV processing error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
