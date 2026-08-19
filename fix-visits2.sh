sed -i '420,440c\
              <ProtectedRoute>\
                <SalesReportPage />\
              </ProtectedRoute>\
            }\
          />\
          <Route\
            path="/visits-report"\
            element={\
              <ProtectedRoute>\
                <VisitsReportPage />\
              </ProtectedRoute>\
            }\
          />\
          <Route\
            path="/task-report"\
            element={\
              <ProtectedRoute>\
                <TaskReportPage />\
              </ProtectedRoute>\
            }\
          />\
          <Route\
            path="/customer-report"\
' src/App.tsx
