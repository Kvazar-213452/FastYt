// app/api/progress/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import CONFIG from "@/lib/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(`${CONFIG.MAIN_SERVER}progress/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          progress: 0, 
          status: 'error', 
          error: data.detail || 'Error fetching progress' 
        },
        { status: response.status }
      );
    }

    // Pass all data from the Python API
    return NextResponse.json({
      progress: data.progress,
      status: data.status,
      title: data.title,
      duration: data.duration,
      duration_string: data.duration_string,
      thumbnail: data.thumbnail,
      uploader: data.uploader,
      view_count: data.view_count,
      filesize: data.filesize,
      speed: data.speed,
      eta: data.eta,
      downloadUrl: data.download_url,
      error: data.error,
      removed: data.removed,
    });
  } catch (error) {
    console.error('Error in API /progress:', error);
    return NextResponse.json(
      { 
        progress: 0, 
        status: 'error', 
        error: 'Server connection error' 
      },
      { status: 500 }
    );
  }
}
