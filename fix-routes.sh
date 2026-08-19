sed -i '440,460c\
          <Route\
            path="/customer-report"\
            element={\
              <ProtectedRoute>\
                <CustomerReportPage />\
              </ProtectedRoute>\
            }\
          />\
          <Route\
            path="/profile"\
            element={\
              <ProtectedRoute>\
                <UserProfilePage />\
              </ProtectedRoute>\
            }\
          />\
\
          {/* Fallback redirect */}\
          <Route path="*" element={<Navigate to="/dashboard" replace />} />\
        </Routes>\
      </BrowserRouter>\
    </AuthProvider>\
  );\
}\
' src/App.tsx
