import Header from '../../components/header';
import Footer from '../../components/footer';
import FullReport from '../../components/full-report';

export const metadata = { title: 'Report · PR Diff Sentinel' };

export default function ReportPage() {
  return (
    <>
      <Header current="scan" />
      <main className="frame frame-report">
        <FullReport />
      </main>
      <Footer />
    </>
  );
}
